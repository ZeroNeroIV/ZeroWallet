/**
 * Purpose: Execute database queries for AI assistant function calls
 *
 * Inputs:
 *   - accountId (string): Current user's account ID
 *
 * Outputs:
 *   - Returns (DataQueryService): Service instance with query methods
 *
 * Side effects:
 *   - Queries database for financial data
 *   - Logs query execution for debugging
 */

import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { GoalRepository } from '../../database/repositories/GoalRepository';
import { DebtRepository } from '../../database/repositories/DebtRepository';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { calculateVaultBalances } from '../../utils/balanceCalculator';
import { logger } from '../../utils/logger';
import type { DataQueryResult } from '../../types/ai';

export class DataQueryService {
  private accountId: string;
  private transactionRepo: TransactionRepository;
  private categoryRepo: CategoryRepository;
  private goalRepo: GoalRepository;
  private debtRepo: DebtRepository;
  private subscriptionRepo: SubscriptionRepository;
  private recurringRepo: RecurringExpenseRepository;
  private accountRepo: AccountRepository;
  private queryHandlers: Map<string, (params: Record<string, any>) => Promise<any>>;

  constructor(accountId: string) {
    this.accountId = accountId;
    this.transactionRepo = new TransactionRepository();
    this.categoryRepo = new CategoryRepository();
    this.goalRepo = new GoalRepository();
    this.debtRepo = new DebtRepository();
    this.subscriptionRepo = new SubscriptionRepository();
    this.recurringRepo = new RecurringExpenseRepository();
    this.accountRepo = new AccountRepository();
    this.queryHandlers = new Map([
      ['getRecentTransactions', (p) => this.getRecentTransactions(p.limit, p.type)],
      ['getMonthlyStats', (p) => this.getMonthlyStats(p.year, p.month)],
      ['getCategoryBreakdown', (p) => this.getCategoryBreakdown(p.startDate, p.endDate, p.type)],
      ['getAccountBalance', () => this.getAccountBalance()],
      ['getActiveGoals', () => this.getActiveGoals()],
      ['getDebtStats', () => this.getDebtStats()],
      ['getActiveSubscriptions', () => this.getActiveSubscriptions()],
      ['getRecurringExpenses', () => this.getRecurringExpenses()],
    ]);
  }

  /**
   * Execute a function by name with parameters
   */
  async executeFunction(
    functionName: string,
    params: Record<string, any>
  ): Promise<DataQueryResult> {
    try {
      logger.info('[DataQuery]', `Executing ${functionName}`, params);
      const handler = this.queryHandlers.get(functionName);
      if (!handler) throw new Error(`Unknown function: ${functionName}`);
      const data = await handler(params);
      return { functionName, data };
    } catch (error: any) {
      logger.error('[DataQuery]', `Error executing ${functionName}`, error);
      return {
        functionName,
        data: null,
        error: error.message || 'Failed to execute query',
      };
    }
  }

  /**
   * Get recent transactions (max 10)
   */
  async getRecentTransactions(limit: number = 10, type?: 'income' | 'expense') {
    try {
      const actualLimit = Math.min(limit, 10);
      const transactions = await this.transactionRepo.findByAccount(
        this.accountId,
        actualLimit * 2
      );

      let filtered = type
        ? transactions.filter((t) => t.type === type)
        : transactions;
      filtered = filtered.slice(0, actualLimit);

      const categoryIds = [...new Set(filtered.map((t) => t.categoryId))];
      const categories = await Promise.all(
        categoryIds.map((id) => this.categoryRepo.findById(id)),
      );
      const categoryMap = new Map(
        categories.filter(Boolean).map((c) => [c!.id, c!.name]),
      );

      return filtered.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        category: categoryMap.get(t.categoryId) || 'Unknown',
        description: t.description || '',
        date: new Date(t.date).toISOString().split('T')[0],
        vault: t.vaultType,
      }));
    } catch (error: any) {
      logger.error('[DataQuery] getRecentTransactions error:', error);
      throw error;
    }
  }

  /**
   * Get monthly statistics (income/expense totals)
   */
  async getMonthlyStats(year: number, month: number) {
    try {
      const startDate = new Date(year, month - 1, 1).getTime();
      const endDate = new Date(year, month, 0, 23, 59, 59, 999).getTime();

      const transactions = await this.transactionRepo.findByDateRange(
        this.accountId,
        startDate,
        endDate
      );

      let totalIncome = 0;
      let totalExpense = 0;

      for (const t of transactions) {
        const amt = t.convertedAmount ?? t.amount;
        if (t.type === 'income') {
          totalIncome += amt;
        } else {
          totalExpense += amt;
        }
      }

      return {
        year,
        month,
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpense: Number(totalExpense.toFixed(2)),
        netSavings: Number((totalIncome - totalExpense).toFixed(2)),
        transactionCount: transactions.length,
      };
    } catch (error: any) {
      logger.error('[DataQuery] getMonthlyStats error:', error);
      throw error;
    }
  }

  /**
   * Get category breakdown for a date range
   */
  async getCategoryBreakdown(
    startDate: string,
    endDate: string,
    type: 'income' | 'expense'
  ) {
    try {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).setHours(23, 59, 59, 999);

      const transactions = await this.transactionRepo.findByDateRange(
        this.accountId,
        start,
        end
      );

      const filtered = transactions.filter((t) => t.type === type);

      const categoryTotals = new Map<string, { total: number; count: number }>();
      let grandTotal = 0;

      for (const tx of filtered) {
        const amt = tx.convertedAmount ?? tx.amount;
        const cur = categoryTotals.get(tx.categoryId) || { total: 0, count: 0 };
        cur.total += amt;
        cur.count += 1;
        categoryTotals.set(tx.categoryId, cur);
        grandTotal += amt;
      }

      const categoryIds = [...categoryTotals.keys()];
      const categories = await Promise.all(
        categoryIds.map((id) => this.categoryRepo.findById(id)),
      );
      const catNameMap = new Map(
        categories.filter(Boolean).map((c) => [c!.id, c!.name]),
      );

      const results = [];
      for (const [categoryId, stats] of categoryTotals.entries()) {
        results.push({
          categoryName: catNameMap.get(categoryId) || 'Unknown',
          total: Number(stats.total.toFixed(2)),
          count: stats.count,
          percentage: Number(((stats.total / (grandTotal || 1)) * 100).toFixed(1)),
        });
      }

      results.sort((a, b) => b.total - a.total);
      return results;
    } catch (error: any) {
      logger.error('[DataQuery] getCategoryBreakdown error:', error);
      throw error;
    }
  }

  /**
   * Get current account balance (vault balances)
   */
  async getAccountBalance() {
    try {
      const account = await this.accountRepo.findById(this.accountId);
      if (!account) throw new Error('Account not found');

      const transactions = await this.transactionRepo.findByAccount(this.accountId);
      const b = calculateVaultBalances(transactions);

      return {
        main: b.mainBalance,
        savings: b.savingsBalance,
        held: b.heldBalance,
        total: b.totalBalance,
        currency: account.currency || 'USD',
      };
    } catch (error: any) {
      logger.error('[DataQuery] getAccountBalance error:', error);
      throw error;
    }
  }

  /**
   * Get all active savings goals
   */
  async getActiveGoals() {
    try {
      const goals = await this.goalRepo.getActiveGoals(this.accountId);

      return goals.map((g) => {
        const target = g.targetAmount ?? 0;
        const current = g.currentAmount ?? 0;
        const progress = target > 0 ? (current / target) * 100 : 0;
        return {
          id: g.id,
          name: g.name,
          targetAmount: Number(target.toFixed(2)),
          currentAmount: Number(current.toFixed(2)),
          progress: Number(progress.toFixed(1)),
        };
      });
    } catch (error: any) {
      logger.error('[DataQuery] getActiveGoals error:', error);
      throw error;
    }
  }

  /**
   * Get debt statistics (lending/borrowing summary)
   */
  async getDebtStats() {
    try {
      const debts = await this.debtRepo.findByAccount(this.accountId);

      let totalLending = 0;
      let totalBorrowing = 0;
      const activeDebts: any[] = [];

      for (const debt of debts) {
        if (debt.status === 'paid') continue;

        const amount = debt.amount || 0;
        const paidAmt = debt.amountPaid || 0;
        const remaining = amount - paidAmt;

        if (debt.type === 'lent') {
          totalLending += remaining;
        } else {
          totalBorrowing += remaining;
        }

        activeDebts.push({
          id: debt.id,
          type: debt.type,
          person: debt.personName,
          totalAmount: Number(amount.toFixed(2)),
          paidAmount: Number(paidAmt.toFixed(2)),
          remaining: Number(remaining.toFixed(2)),
          dueDate: debt.dueDate
            ? new Date(debt.dueDate).toISOString().split('T')[0]
            : null,
        });
      }

      return {
        totalLending: Number(totalLending.toFixed(2)),
        totalBorrowing: Number(totalBorrowing.toFixed(2)),
        netPosition: Number((totalLending - totalBorrowing).toFixed(2)),
        activeDebts: activeDebts.slice(0, 10),
      };
    } catch (error: any) {
      logger.error('[DataQuery] getDebtStats error:', error);
      throw error;
    }
  }

  /**
   * Get all active subscriptions
   */
  async getActiveSubscriptions() {
    try {
      const subscriptions = await this.subscriptionRepo.findActiveByAccount(
        this.accountId
      );

      const categoryIds = [...new Set(subscriptions.map((s) => s.categoryId))];
      const categories = await Promise.all(
        categoryIds.map((id) => this.categoryRepo.findById(id)),
      );
      const catNameMap = new Map(
        categories.filter(Boolean).map((c) => [c!.id, c!.name]),
      );

      return subscriptions.map((sub) => ({
        id: sub.id,
        name: sub.name,
        amount: Number(sub.amount.toFixed(2)),
        nextBillingDate: new Date(sub.nextProcessing)
          .toISOString()
          .split('T')[0],
        category: catNameMap.get(sub.categoryId) || 'Unknown',
      }));
    } catch (error: any) {
      logger.error('[DataQuery] getActiveSubscriptions error:', error);
      throw error;
    }
  }

  /**
   * Get all recurring expenses
   */
  async getRecurringExpenses() {
    try {
      const expenses = await this.recurringRepo.findActiveByAccount(this.accountId);

      const categoryIds = [...new Set(expenses.map((e) => e.categoryId))];
      const categories = await Promise.all(
        categoryIds.map((id) => this.categoryRepo.findById(id)),
      );
      const catNameMap = new Map(
        categories.filter(Boolean).map((c) => [c!.id, c!.name]),
      );

      return expenses.map((expense) => ({
        id: expense.id,
        name: expense.name,
        amount: Number(expense.amount.toFixed(2)),
        frequency: expense.frequency,
        nextDate: new Date(expense.nextOccurrence).toISOString().split('T')[0],
        category: catNameMap.get(expense.categoryId) || 'Unknown',
      }));
    } catch (error: any) {
      logger.error('[DataQuery] getRecurringExpenses error:', error);
      throw error;
    }
  }
}
