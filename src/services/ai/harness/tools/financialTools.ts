/**
 * LAYA Financial Agent Harness — Modular Financial Tools Suite
 *
 * Provides declarative tool specifications and executable handlers for:
 *  - Data queries (balances, transactions, stats, subscriptions, debts)
 *  - Generative UI widgets (interactive charts, proposal cards, health gauges)
 *  - Safe financial mutations (with confirmation tickets)
 */

import type { ExecutableTool, AgentExecutionContext, ToolExecutionResult } from '../types';
import type { FinancialWidget } from '../../../../types/ai';
import { DataQueryService } from '../../dataQueryService';
import { DataMutationService } from '../../dataMutationService';
import { WRITE_FUNCTION_NAMES_SET } from '../../functionRegistry';

// Palette for visual chart series
const CHART_PALETTE = ['#00E5FF', '#7C4DFF', '#00E676', '#FFB300', '#FF5252', '#E040FB', '#40C4FF', '#69F0AE'];

export class FinancialToolRegistry {
  private dataQuery: DataQueryService;
  private dataMutation: DataMutationService;
  private tools: Map<string, ExecutableTool> = new Map();

  constructor(accountId: string, userId: string) {
    this.dataQuery = new DataQueryService(accountId);
    this.dataMutation = new DataMutationService(accountId, userId);
    this.registerAllTools();
  }

  getToolDefinitions(): any[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  getExecutableTool(name: string): ExecutableTool | undefined {
    return this.tools.get(name);
  }

  private register(tool: ExecutableTool) {
    this.tools.set(tool.name, tool);
  }

  private registerAllTools() {
    // ══════════════════════════════════════════════════════════
    // 1. GENERATIVE UI & VISUAL TOOLS
    // ══════════════════════════════════════════════════════════

    this.register({
      name: 'generateChart',
      description:
        'Generates an interactive visual chart rendered directly in the user chat stream. Use this whenever the user asks to see, visualize, graph, or breakdown spending, income, or financial trends.',
      kind: 'visual',
      parameters: {
        type: 'object',
        properties: {
          chartType: {
            type: 'string',
            enum: ['donut', 'pie', 'bar', 'line'],
            description: 'The type of chart to display: donut or pie for category share, bar for comparisons, line for timeline trends.',
          },
          title: {
            type: 'string',
            description: 'Clear, concise chart title (e.g. "October Spending Breakdown" or "Income vs Expenses").',
          },
          data: {
            type: 'array',
            description: 'List of data points with label and value.',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Category or timeline label (e.g. "Food", "Rent", "Oct")' },
                value: { type: 'number', description: 'Primary numeric amount' },
                secondaryValue: { type: 'number', description: 'Optional secondary value (e.g. expenses in an income vs expense bar chart)' },
                color: { type: 'string', description: 'Optional hex color' },
              },
            },
          },
          summary: {
            type: 'string',
            description: 'Short analytical takeaway (e.g. "Food represents 42% of your total spend this month").',
          },
        },
        required: ['chartType', 'title', 'data'],
      },
      execute: async (args: any, context: AgentExecutionContext): Promise<ToolExecutionResult> => {
        const dataWithColors = (args.data || []).map((d: any, idx: number) => ({
          label: String(d.label || 'Other'),
          value: Math.max(0, Number(d.value || 0)),
          secondaryValue: d.secondaryValue !== undefined ? Number(d.secondaryValue) : undefined,
          color: d.color || CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

        const total = dataWithColors.reduce((sum: number, item: any) => sum + item.value, 0);

        const widget: FinancialWidget = {
          type: 'chart',
          chartType: args.chartType,
          title: args.title,
          data: dataWithColors,
          summary: args.summary,
          total,
          currency: context.currency,
        };

        return {
          success: true,
          data: { generated: true, title: args.title, totalPoints: dataWithColors.length },
          widget,
        };
      },
    });

    this.register({
      name: 'proposeTransaction',
      description:
        'Creates an interactive transaction proposal widget with instant 1-tap confirmation card. Use this when the user mentions an expense or income.',
      kind: 'visual',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['income', 'expense'], description: 'Transaction type' },
          amount: { type: 'number', description: 'Amount (positive number)' },
          categoryName: { type: 'string', description: 'Category name (e.g. Food & Dining, Transportation)' },
          description: { type: 'string', description: 'Notes or payee description' },
          vaultType: { type: 'string', description: 'Wallet name/vault: main, savings, card, physical' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' },
        },
        required: ['type', 'amount', 'categoryName'],
      },
      execute: async (args: any, context: AgentExecutionContext): Promise<ToolExecutionResult> => {
        const pendingAction = await this.dataMutation.createTransactionAction({
          type: args.type,
          amount: Number(args.amount),
          categoryName: args.categoryName,
          description: args.description || '',
          vaultType: args.vaultType || 'main',
          date: args.date,
        });

        const widget: FinancialWidget = {
          type: 'transaction_proposal',
          transaction: {
            type: args.type,
            amount: Number(args.amount),
            currency: context.currency,
            categoryName: args.categoryName,
            vaultType: args.vaultType || 'main',
            date: args.date || new Date().toISOString().split('T')[0],
            description: args.description || '',
          },
          pendingActionId: pendingAction.id,
        };

        return {
          success: true,
          data: { pendingActionId: pendingAction.id, summary: pendingAction.summary },
          pendingAction,
          widget,
        };
      },
    });

    this.register({
      name: 'calculateFinancialHealth',
      description:
        'Audits user financial health, calculates emergency runway in months, net savings rate, burn rate, and assigns an overall health score (0-100) with grade and proactive recommendations.',
      kind: 'visual',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async (_args: any, _context: AgentExecutionContext): Promise<ToolExecutionResult> => {
        const balanceData = await this.dataQuery.getAccountBalance();
        const now = new Date();
        const stats = await this.dataQuery.getMonthlyStats(now.getFullYear(), now.getMonth() + 1);
        const recurring = await this.dataQuery.getRecurringExpenses();
        const subscriptions = await this.dataQuery.getActiveSubscriptions();

        const totalBalance = balanceData?.total ?? 0;
        const monthlyExpense = stats?.totalExpense ?? 0;
        const monthlyIncome = stats?.totalIncome ?? 0;

        const recurringBurn = (recurring || []).reduce((acc: number, r: any) => acc + (r.amount || 0), 0) +
          (subscriptions || []).reduce((acc: number, s: any) => acc + (s.amount || 0), 0);

        const effectiveMonthlyBurn = Math.max(monthlyExpense, recurringBurn, 1);
        const runwayMonths = parseFloat((totalBalance / effectiveMonthlyBurn).toFixed(1));

        let savingsRate = 0;
        if (monthlyIncome > 0) {
          savingsRate = Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100);
        }

        let score = 50;
        const recommendations: string[] = [];

        if (runwayMonths >= 6) {
          score += 25;
          recommendations.push('Superb emergency runway (6+ months). Consider directing excess yield to growth goals.');
        } else if (runwayMonths >= 3) {
          score += 15;
          recommendations.push('Stable 3-6 month runway. Maintain disciplined savings rate.');
        } else {
          score -= 20;
          recommendations.push(`Runway is ${runwayMonths} months. Prioritize building emergency vault up to 3 months of burn.`);
        }

        if (savingsRate >= 20) {
          score += 25;
          recommendations.push(`Strong savings rate at ${savingsRate}%.`);
        } else if (savingsRate > 0) {
          score += 10;
          recommendations.push(`Positive savings rate (${savingsRate}%). Target reaching 20%+ for long-term compounding.`);
        } else {
          score -= 15;
          recommendations.push('Monthly expenses currently exceed or equal income. Review discretionary categories.');
        }

        score = Math.max(10, Math.min(100, score));

        let grade: 'EXCELLENT' | 'STABLE' | 'NEEDS_ATTENTION' | 'CRITICAL' = 'STABLE';
        if (score >= 80) grade = 'EXCELLENT';
        else if (score >= 60) grade = 'STABLE';
        else if (score >= 40) grade = 'NEEDS_ATTENTION';
        else grade = 'CRITICAL';

        const widget: FinancialWidget = {
          type: 'health_score',
          score,
          grade,
          runwayMonths,
          savingsRate,
          burnRate: effectiveMonthlyBurn,
          recommendations,
        };

        return {
          success: true,
          data: { score, grade, runwayMonths, savingsRate, burnRate: effectiveMonthlyBurn },
          widget,
        };
      },
    });

    // ══════════════════════════════════════════════════════════
    // 2. READ & QUERY TOOLS
    // ══════════════════════════════════════════════════════════

    this.register({
      name: 'getAccountBalance',
      description: 'Get current account balance across all vaults (main, savings, card, physical).',
      kind: 'read',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const data = await this.dataQuery.getAccountBalance();
        return { success: true, data };
      },
    });

    this.register({
      name: 'getRecentTransactions',
      description: 'Get recent transactions (max 10), optionally filtered by income or expense.',
      kind: 'read',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of transactions (1-10)' },
          type: { type: 'string', enum: ['income', 'expense'], description: 'Optional transaction type filter' },
        },
      },
      execute: async (args) => {
        const data = await this.dataQuery.getRecentTransactions(args.limit, args.type);
        return { success: true, data };
      },
    });

    this.register({
      name: 'getMonthlyStats',
      description: 'Get income, expense totals and net savings for a specific year and month.',
      kind: 'read',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number', description: 'Year, e.g. 2026' },
          month: { type: 'number', description: 'Month (1-12)' },
        },
        required: ['year', 'month'],
      },
      execute: async (args) => {
        const data = await this.dataQuery.getMonthlyStats(Number(args.year), Number(args.month));
        return { success: true, data };
      },
    });

    this.register({
      name: 'getCategoryBreakdown',
      description: 'Get spending or income breakdown by category for a date range.',
      kind: 'read',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in YYYY-MM-DD' },
          endDate: { type: 'string', description: 'End date in YYYY-MM-DD' },
          type: { type: 'string', enum: ['income', 'expense'], description: 'Type of transactions to group' },
        },
        required: ['startDate', 'endDate', 'type'],
      },
      execute: async (args, context) => {
        const data = await this.dataQuery.getCategoryBreakdown(args.startDate, args.endDate, args.type);

        // Automatically prepare a donut/pie chart widget if meaningful category data exists
        let widget: FinancialWidget | undefined;
        if (Array.isArray(data) && data.length > 0) {
          const chartData = data.slice(0, 6).map((item: any, idx: number) => ({
            label: item.categoryName || 'Other',
            value: Number(item.total || 0),
            color: item.categoryColor || CHART_PALETTE[idx % CHART_PALETTE.length],
          }));
          const total = chartData.reduce((acc, c) => acc + c.value, 0);

          widget = {
            type: 'chart',
            chartType: 'donut',
            title: `${args.type === 'income' ? 'Income' : 'Spending'} by Category`,
            data: chartData,
            summary: `Top category: ${chartData[0]?.label} (${total > 0 ? ((chartData[0]?.value / total) * 100).toFixed(0) : 0}%)`,
            total,
            currency: context.currency,
          };
        }

        return { success: true, data, widget };
      },
    });

    this.register({
      name: 'getActiveGoals',
      description: 'Get all active savings goals and target progress.',
      kind: 'read',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const data = await this.dataQuery.getActiveGoals();
        return { success: true, data };
      },
    });

    this.register({
      name: 'getDebtStats',
      description: 'Get lent and borrowed debts, totals, and open balances.',
      kind: 'read',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const data = await this.dataQuery.getDebtStats();
        return { success: true, data };
      },
    });

    this.register({
      name: 'getActiveSubscriptions',
      description: 'Get active monthly subscriptions and recurring commitments.',
      kind: 'read',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const data = await this.dataQuery.getActiveSubscriptions();
        return { success: true, data };
      },
    });

    this.register({
      name: 'getRecurringExpenses',
      description: 'Get upcoming scheduled recurring expenses and utility bills.',
      kind: 'read',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const data = await this.dataQuery.getRecurringExpenses();
        return { success: true, data };
      },
    });

    // ══════════════════════════════════════════════════════════
    // 3. MUTATION TOOLS (Creating confirmation tickets)
    // ══════════════════════════════════════════════════════════

    const mutationHandlers: Record<string, (p: any) => Promise<any>> = {
      createTransaction: this.dataMutation.createTransactionAction.bind(this.dataMutation),
      updateTransaction: this.dataMutation.updateTransactionAction.bind(this.dataMutation),
      deleteTransaction: this.dataMutation.deleteTransactionAction.bind(this.dataMutation),
      createGoal: this.dataMutation.createGoalAction.bind(this.dataMutation),
      updateGoal: this.dataMutation.updateGoalAction.bind(this.dataMutation),
      deleteGoal: this.dataMutation.deleteGoalAction.bind(this.dataMutation),
      createDebt: this.dataMutation.createDebtAction.bind(this.dataMutation),
      updateDebt: this.dataMutation.updateDebtAction.bind(this.dataMutation),
      deleteDebt: this.dataMutation.deleteDebtAction.bind(this.dataMutation),
      createSubscription: this.dataMutation.createSubscriptionAction.bind(this.dataMutation),
      deleteSubscription: this.dataMutation.deleteSubscriptionAction.bind(this.dataMutation),
      createRecurringExpense: this.dataMutation.createRecurringExpenseAction.bind(this.dataMutation),
      deleteRecurringExpense: this.dataMutation.deleteRecurringExpenseAction.bind(this.dataMutation),
      createCategory: this.dataMutation.createCategoryAction.bind(this.dataMutation),
    };

    Object.entries(mutationHandlers).forEach(([name, handler]) => {
      this.register({
        name,
        description: `Perform ${name} operation. REQUIRES USER CONFIRMATION via interactive ticket.`,
        kind: 'write',
        parameters: {
          type: 'object',
          properties: {
            parameters: { type: 'object', description: 'Arguments for the mutation' },
          },
        },
        execute: async (args: any, context: AgentExecutionContext): Promise<ToolExecutionResult> => {
          try {
            const pendingAction = await handler(args);
            let widget: FinancialWidget | undefined;

            if (name === 'createTransaction' && args.amount) {
              widget = {
                type: 'transaction_proposal',
                transaction: {
                  type: args.type || 'expense',
                  amount: Number(args.amount),
                  currency: context.currency,
                  categoryName: args.categoryName || 'General',
                  vaultType: args.vaultType || 'main',
                  date: args.date || new Date().toISOString().split('T')[0],
                  description: args.description || '',
                },
                pendingActionId: pendingAction.id,
              };
            }

            return {
              success: true,
              data: { pendingActionId: pendingAction.id, summary: pendingAction.summary },
              pendingAction,
              widget,
            };
          } catch (error: any) {
            return {
              success: false,
              error: error.userMessage || error.message || 'Mutation failed',
            };
          }
        },
      });
    });
  }
}
