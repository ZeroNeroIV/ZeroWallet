// DashboardService — facade that encapsulates all data-loading for DashboardScreen
import { startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { TransactionRepository } from '../database/repositories/TransactionRepository';
import { CategoryRepository } from '../database/repositories/CategoryRepository';
import { GoalRepository } from '../database/repositories/GoalRepository';
import { DebtRepository } from '../database/repositories/DebtRepository';
import { SubscriptionRepository } from '../database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../database/repositories/RecurringExpenseRepository';
import { AccountRepository } from '../database/repositories/AccountRepository';
import { calculateVaultBalances, type VaultBalances } from '../utils/balanceCalculator';
import { calculateGoalProgress } from '../utils/goalUtils';
import { type Transaction, type Category, type Goal, type Debt } from '../types/models';
import { logger } from '../utils/logger';

export interface TransactionWithCat extends Transaction {
  category: Category;
}

export interface ChartDayPoint {
  day: string;
  income: number;
  expense: number;
}

export interface MonthPoint {
  month: string;
  income: number;
  expense: number;
}

export interface CategorySpend {
  name: string;
  amount: number;
  color: string;
}

export interface GoalsCount {
  total: number;
  active: number;
  completed: number;
}

export interface DebtStat {
  totalLent: number;
  totalBorrowed: number;
}

export interface DashboardData {
  balance: VaultBalances;
  currency: string;
  recentTransactions: TransactionWithCat[];
  chartData: ChartDayPoint[];
  monthlyData: MonthPoint[];
  categorySpend: CategorySpend[];
  totalMonthSpend: number;
  activeGoals: Goal[];
  activeDebts: Debt[];
  goalsCount: GoalsCount;
  debtsStats: DebtStat;
  subscriptionsCount: number;
  categoriesCount: number;
  recurringCount: number;
}

export class DashboardService {
  private transactionRepo: TransactionRepository;
  private categoryRepo: CategoryRepository;
  private goalRepo: GoalRepository;
  private debtRepo: DebtRepository;
  private subscriptionRepo: SubscriptionRepository;
  private recurringRepo: RecurringExpenseRepository;
  private accountRepo: AccountRepository;

  constructor(
    private accountId: string,
    private userId: string,
  ) {
    this.transactionRepo = new TransactionRepository();
    this.categoryRepo = new CategoryRepository();
    this.goalRepo = new GoalRepository();
    this.debtRepo = new DebtRepository();
    this.subscriptionRepo = new SubscriptionRepository();
    this.recurringRepo = new RecurringExpenseRepository();
    this.accountRepo = new AccountRepository();
  }

  async loadAll(): Promise<DashboardData> {
    const [balance, currency, recentTransactions, chartData, monthlyData, categorySpend, activeGoals, activeDebts, goalsCount, debtsStats, subscriptionsCount, categoriesCount, recurringCount] =
      await Promise.all([
        this.loadBalance(),
        this.loadCurrency(),
        this.loadRecentTransactions(),
        this.loadChartData(),
        this.loadMonthlyData(),
        this.loadCategorySpend(),
        this.loadGoalsAndDebts(),
        this.loadActiveDebts(),
        this.loadGoalsCount(),
        this.loadDebtsStats(),
        this.loadSubscriptionsCount(),
        this.loadCategoriesCount(),
        this.loadRecurringCount(),
      ]);

    const totalMonthSpend = categorySpend.reduce((sum, s) => sum + s.amount, 0);

    return {
      balance,
      currency,
      recentTransactions,
      chartData,
      monthlyData,
      categorySpend,
      totalMonthSpend,
      activeGoals,
      activeDebts,
      goalsCount,
      debtsStats,
      subscriptionsCount,
      categoriesCount,
      recurringCount,
    };
  }

  async checkBackgroundTasks(): Promise<string[]> {
    const notifications: string[] = [];

    try {
      const { checkAndProcessAutoSalary } = await import('./backgroundTasks/autoSalaryTask');
      const salaryResult = await checkAndProcessAutoSalary();
      if (salaryResult.processed && salaryResult.count > 0) {
        const monthText = salaryResult.count === 1 ? '1 month' : `${salaryResult.count} months`;
        notifications.push(`💰 Salary: ${monthText} added (${salaryResult.totalAmount.toFixed(2)})`);
      }

      const { checkAndProcessSubscriptions } = await import('./backgroundTasks/subscriptionTask');
      const subscriptionResult = await checkAndProcessSubscriptions(this.accountId);
      if (subscriptionResult.processed > 0) {
        notifications.push(`📱 Subscriptions: ${subscriptionResult.processed} processed (-${subscriptionResult.totalAmount.toFixed(2)})`);
      }

      const { checkAndProcessRecurringExpenses } = await import('./backgroundTasks/recurringExpenseTask');
      const recurringResult = await checkAndProcessRecurringExpenses(this.accountId);
      if (recurringResult.processed > 0) {
        notifications.push(`🔄 Recurring: ${recurringResult.processed} processed (-${recurringResult.totalAmount.toFixed(2)})`);
      }

      const { checkAndCompleteGoals } = await import('./backgroundTasks/goalTask');
      const goalResult = await checkAndCompleteGoals(this.accountId);
      if (goalResult.completed.length > 0) {
        const goalNames = goalResult.completed.map(g => g.name).join(', ');
        notifications.push(`🎯 Goals Completed: ${goalNames}`);
      }
    } catch (error) {
      logger.error('[DashboardService] Background tasks error:', error);
    }

    return notifications;
  }

  // ── Private loaders ──────────────────────────────────────

  private async loadBalance(): Promise<VaultBalances> {
    const allTransactions = await this.transactionRepo.findByAccount(this.accountId);
    const balances = calculateVaultBalances(allTransactions);
    const { updateBalance } = (await import('../store/accountStore')).useAccountStore.getState();
    updateBalance(this.accountId, balances);
    return balances;
  }

  private async loadCurrency(): Promise<string> {
    try {
      const account = await this.accountRepo.findById(this.accountId);
      return account?.currency ?? 'USD';
    } catch {
      return 'USD';
    }
  }

  private async loadRecentTransactions(): Promise<TransactionWithCat[]> {
    try {
      const transactions = await this.transactionRepo.findByAccount(this.accountId, 5);
      const categories = await this.categoryRepo.findByUser(this.userId);
      const catMap = new Map(categories.map(c => [c.id, c]));
      return transactions
        .map(t => ({ ...t, category: catMap.get(t.categoryId)! }))
        .filter((t): t is TransactionWithCat => !!t.category);
    } catch (error) {
      logger.error('[DashboardService] loadRecentTransactions error:', error);
      return [];
    }
  }

  private async loadChartData(): Promise<ChartDayPoint[]> {
    try {
      const today = endOfDay(new Date());
      const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
      const transactions = await this.transactionRepo.findByDateRange(
        this.accountId, sevenDaysAgo.getTime(), today.getTime(),
      );

      const dataByDay = new Map<string, { income: number; expense: number }>();
      for (let i = 0; i < 7; i++) {
        const day = startOfDay(subDays(new Date(), 6 - i));
        dataByDay.set(format(day, 'MMM d'), { income: 0, expense: 0 });
      }

      for (const tx of transactions) {
        const dayKey = format(new Date(tx.date), 'MMM d');
        const current = dataByDay.get(dayKey);
        if (!current) continue;
        const amount = tx.convertedAmount ?? tx.amount;
        if (tx.type === 'income') current.income += amount;
        else current.expense += amount;
      }

      return Array.from(dataByDay.entries()).map(([day, v]) => ({
        day, income: v.income, expense: v.expense,
      }));
    } catch (error) {
      logger.error('[DashboardService] loadChartData error:', error);
      return [];
    }
  }

  private async loadMonthlyData(): Promise<MonthPoint[]> {
    try {
      const result: MonthPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const start = startOfMonth(monthDate).getTime();
        const end = endOfMonth(monthDate).getTime();
        const txns = await this.transactionRepo.findByDateRange(this.accountId, start, end);
        let income = 0, expense = 0;
        for (const t of txns) {
          const amt = t.convertedAmount ?? t.amount;
          if (t.type === 'income') income += amt;
          else expense += amt;
        }
        result.push({ month: format(monthDate, 'MMM'), income, expense });
      }
      return result;
    } catch (error) {
      logger.error('[DashboardService] loadMonthlyData error:', error);
      return [];
    }
  }

  private async loadCategorySpend(): Promise<CategorySpend[]> {
    try {
      const start = startOfMonth(new Date()).getTime();
      const end = endOfMonth(new Date()).getTime();
      const txns = await this.transactionRepo.findByDateRange(this.accountId, start, end);
      const categories = await this.categoryRepo.findByUser(this.userId);
      const catMap = new Map(categories.map(c => [c.id, c]));
      const spendMap = new Map<string, CategorySpend>();

      for (const t of txns) {
        if (t.type !== 'expense') continue;
        const amt = t.convertedAmount ?? t.amount;
        const cat = catMap.get(t.categoryId);
        if (!cat) continue;
        const existing = spendMap.get(cat.id);
        if (existing) existing.amount += amt;
        else spendMap.set(cat.id, { name: cat.name, amount: amt, color: cat.color });
      }

      return Array.from(spendMap.values()).sort((a, b) => b.amount - a.amount);
    } catch (error) {
      logger.error('[DashboardService] loadCategorySpend error:', error);
      return [];
    }
  }

  private async loadGoalsAndDebts(): Promise<Goal[]> {
    try {
      const goals = await this.goalRepo.getActiveGoals(this.accountId);
      const { balances: freshBalances } = (await import('../store/accountStore')).useAccountStore.getState();
      const balance = freshBalances[this.accountId] ?? {
        mainBalance: 0, savingsBalance: 0, heldBalance: 0,
        totalBalance: 0, availableBalance: 0,
      };
      for (const goal of goals) {
        const newProgress = calculateGoalProgress(goal, balance);
        if (newProgress !== goal.currentAmount) {
          await this.goalRepo.updateProgress(goal.id, newProgress);
          goal.currentAmount = newProgress;
        }
      }
      return goals;
    } catch (error) {
      logger.error('[DashboardService] loadGoalsAndDebts error:', error);
      return [];
    }
  }

  private async loadActiveDebts(): Promise<Debt[]> {
    try {
      const allDebts = await this.debtRepo.findByAccount(this.accountId);
      return allDebts.filter(debt => (debt.amountPaid || 0) < debt.amount);
    } catch {
      return [];
    }
  }

  private async loadGoalsCount(): Promise<GoalsCount> {
    try {
      return await this.goalRepo.getGoalsCount(this.accountId);
    } catch {
      return { total: 0, active: 0, completed: 0 };
    }
  }

  private async loadDebtsStats(): Promise<DebtStat> {
    try {
      return await this.debtRepo.getDebtStats(this.accountId);
    } catch {
      return { totalLent: 0, totalBorrowed: 0 };
    }
  }

  private async loadSubscriptionsCount(): Promise<number> {
    try {
      const subs = await this.subscriptionRepo.findActiveByAccount(this.accountId);
      return subs.length;
    } catch {
      return 0;
    }
  }

  private async loadCategoriesCount(): Promise<number> {
    try {
      const cats = await this.categoryRepo.findByUser(this.userId);
      return cats.length;
    } catch {
      return 0;
    }
  }

  private async loadRecurringCount(): Promise<number> {
    try {
      const recs = await this.recurringRepo.findActiveByAccount(this.accountId);
      return recs.length;
    } catch {
      return 0;
    }
  }
}
