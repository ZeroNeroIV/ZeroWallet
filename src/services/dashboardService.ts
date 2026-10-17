// DashboardService — facade that encapsulates all data-loading for DashboardScreen
import { startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { TransactionRepository } from '../database/repositories/TransactionRepository';
import { CategoryRepository } from '../database/repositories/CategoryRepository';
import { GoalRepository } from '../database/repositories/GoalRepository';
import { DebtRepository } from '../database/repositories/DebtRepository';
import { SubscriptionRepository } from '../database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../database/repositories/RecurringExpenseRepository';
import { AccountRepository } from '../database/repositories/AccountRepository';
import { WalletRepository } from '../database/repositories/WalletRepository';
import { executeSql } from '../database';
import { calculateVaultBalances, type VaultBalances } from '../utils/balanceCalculator';
import { calculateGoalProgress } from '../utils/goalUtils';
import { type Transaction, type Category, type Goal, type Debt, type Wallet } from '../types/models';
import { logger } from '../utils/logger';

export interface TransactionWithCat extends Transaction {
  category: Category;
}

export interface ChartDayPoint {
  day: string;
  income: number;
  expense: number;
}

export interface UpcomingRecurringItem {
  id: string;
  name: string;
  amount: number;
  daysUntil: number;
  formattedDate: string;
}

export interface CashFlow30DayPoint {
  date: string;
  day: string;
  value: number; // cumulative
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
  upcomingRecurring?: UpcomingRecurringItem | null;
  trend30Day?: CashFlow30DayPoint[];
  net30DayChange?: number;
  wallets?: Wallet[];
  derivedBalances?: Record<string, number>;
}

export class DashboardService {
  private transactionRepo: TransactionRepository;
  private categoryRepo: CategoryRepository;
  private goalRepo: GoalRepository;
  private debtRepo: DebtRepository;
  private subscriptionRepo: SubscriptionRepository;
  private recurringRepo: RecurringExpenseRepository;
  private accountRepo: AccountRepository;
  private walletRepo: WalletRepository;

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
    this.walletRepo = new WalletRepository();
  }

  async loadAll(): Promise<DashboardData> {
    const [
      allTransactions,
      allCategories,
      currency,
      activeGoals,
      activeDebts,
      goalsCount,
      debtsStats,
      subscriptionsCount,
      recurringCount,
      upcomingRecurring,
      walletData,
    ] = await Promise.all([
      this.transactionRepo.findByAccount(this.accountId),
      this.categoryRepo.findByUser(this.userId),
      this.loadCurrency(),
      this.loadGoalsAndDebts(),
      this.loadActiveDebts(),
      this.loadGoalsCount(),
      this.loadDebtsStats(),
      this.loadSubscriptionsCount(),
      this.loadRecurringCount(),
      this.loadUpcomingRecurring(),
      this.loadWalletsAndBalances(),
    ]);

    const balance = this.computeBalance(allTransactions, walletData.derivedBalances);
    const recentTransactions = this.computeRecentTransactions(allTransactions, allCategories);
    const chartData = this.computeChartData(allTransactions);
    const monthlyData = this.computeMonthlyData(allTransactions);
    const categorySpend = this.computeCategorySpend(allTransactions, allCategories);
    const trendData = this.compute30DayTrend(allTransactions);
    const categoriesCount = allCategories.length;
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
      upcomingRecurring,
      trend30Day: trendData.points,
      net30DayChange: trendData.netChange,
      wallets: walletData.wallets,
      derivedBalances: walletData.derivedBalances,
    };
  }

  async checkBackgroundTasks(): Promise<string[]> {
    const notifications: string[] = [];

    try {
      const { checkAndPromptHitlTasks } = await import('./hitl/hitlService');
      const pendingCount = await checkAndPromptHitlTasks(this.accountId);
      if (pendingCount > 0) {
        notifications.push(`⏳ ${pendingCount} recurring commitment(s) awaiting approval`);
      }

      const { checkAndCompleteGoals } = await import('./backgroundTasks/goalTask');
      const goalResult = await checkAndCompleteGoals(this.accountId);
      if (goalResult.completed.length > 0) {
        const goalNames = goalResult.completed.map((g) => g.name).join(', ');
        notifications.push(`🎯 Goals Completed: ${goalNames}`);
      }
    } catch (error) {
      logger.error('[DashboardService]', 'Background tasks error', error);
    }

    return notifications;
  }

  // ── Private loaders & computers ──────────────────────────

  private computeBalance(
    allTransactions: Transaction[],
    derivedBalances: Record<string, number>,
  ): VaultBalances {
    const balances = calculateVaultBalances(allTransactions);
    const derivedKeys = Object.keys(derivedBalances);
    if (derivedKeys.length > 0) {
      let derivedTotal = 0;
      for (const k of derivedKeys) {
        derivedTotal += Number(derivedBalances[k]) || 0;
      }
      balances.totalBalance = Math.round(derivedTotal * 1000) / 1000;
      balances.availableBalance =
        Math.round((derivedTotal - (derivedBalances.held ?? balances.heldBalance ?? 0)) * 1000) /
        1000;
    }
    const { useAccountStore } = require('../store/accountStore');
    useAccountStore.getState().updateBalance(this.accountId, balances);
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

  private computeRecentTransactions(
    allTransactions: Transaction[],
    categories: Category[],
  ): TransactionWithCat[] {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    return allTransactions.slice(0, 5).map((t) => ({
      ...t,
      category: catMap.get(t.categoryId) ?? {
        id: t.categoryId,
        userId: this.userId,
        name: t.destinationWalletId || t.type === 'transfer' ? 'Transfer' : 'Unknown',
        type: t.type === 'income' ? 'income' : 'expense',
        icon: t.destinationWalletId || t.type === 'transfer' ? 'swap-horizontal' : 'help-circle',
        color: '#999',
        isDefault: false,
        createdAt: 0,
      },
    }));
  }

  private computeChartData(allTransactions: Transaction[]): ChartDayPoint[] {
    const now = new Date();
    const today = endOfDay(now).getTime();
    const sevenDaysAgo = startOfDay(subDays(now, 6)).getTime();

    const dataByDay = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < 7; i++) {
      const day = startOfDay(subDays(now, 6 - i));
      dataByDay.set(format(day, 'MMM d'), { income: 0, expense: 0 });
    }

    for (const tx of allTransactions) {
      if (tx.date < sevenDaysAgo || tx.date > today) continue;
      if (tx.type === 'transfer' || Boolean(tx.destinationWalletId)) continue;
      const dayKey = format(new Date(tx.date), 'MMM d');
      const current = dataByDay.get(dayKey);
      if (!current) continue;
      const amount = tx.convertedAmount ?? tx.amount;
      if (tx.type === 'income') current.income += amount;
      else if (tx.type === 'expense') current.expense += amount;
    }

    return Array.from(dataByDay.entries()).map(([day, v]) => ({
      day,
      income: v.income,
      expense: v.expense,
    }));
  }

  private computeMonthlyData(allTransactions: Transaction[]): MonthPoint[] {
    const now = new Date();
    const buckets: Array<{ month: string; start: number; end: number; income: number; expense: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      buckets.push({
        month: format(monthDate, 'MMM'),
        start: startOfMonth(monthDate).getTime(),
        end: endOfMonth(monthDate).getTime(),
        income: 0,
        expense: 0,
      });
    }

    const earliest = buckets[0]?.start ?? 0;
    const latest = buckets[buckets.length - 1]?.end ?? 0;

    for (const t of allTransactions) {
      if (t.date < earliest || t.date > latest) continue;
      if (t.type === 'transfer' || Boolean(t.destinationWalletId)) continue;
      const amt = t.convertedAmount ?? t.amount;
      for (const b of buckets) {
        if (t.date >= b.start && t.date <= b.end) {
          if (t.type === 'income') b.income += amt;
          else if (t.type === 'expense') b.expense += amt;
          break;
        }
      }
    }

    return buckets.map(({ month, income, expense }) => ({ month, income, expense }));
  }

  private computeCategorySpend(
    allTransactions: Transaction[],
    categories: Category[],
  ): CategorySpend[] {
    const now = new Date();
    const start = startOfMonth(now).getTime();
    const end = endOfMonth(now).getTime();
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const spendMap = new Map<string, CategorySpend>();

    for (const t of allTransactions) {
      if (t.date < start || t.date > end) continue;
      if (t.type !== 'expense' || Boolean(t.destinationWalletId)) continue;
      const amt = t.convertedAmount ?? t.amount;
      const cat = catMap.get(t.categoryId) ?? {
        id: t.categoryId,
        name: 'Unknown',
        color: '#999',
      };
      if (cat.name.toLowerCase() === 'transfer') continue;
      const existing = spendMap.get(cat.id);
      if (existing) existing.amount += amt;
      else spendMap.set(cat.id, { name: cat.name, amount: amt, color: cat.color });
    }

    return Array.from(spendMap.values()).sort((a, b) => b.amount - a.amount);
  }

  private async loadGoalsAndDebts(): Promise<Goal[]> {
    try {
      return await this.goalRepo.getActiveGoals(this.accountId);
    } catch (error) {
      logger.error('[DashboardService]', 'loadGoalsAndDebts error', error);
      return [];
    }
  }

  private async loadActiveDebts(): Promise<Debt[]> {
    try {
      const allDebts = await this.debtRepo.findByAccount(this.accountId);
      return allDebts.filter((debt) => (debt.amountPaid || 0) < debt.amount);
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

  private async loadRecurringCount(): Promise<number> {
    try {
      const recs = await this.recurringRepo.findActiveByAccount(this.accountId);
      return recs.length;
    } catch {
      return 0;
    }
  }

  private async loadWalletsAndBalances(): Promise<{
    wallets: Wallet[];
    derivedBalances: Record<string, number>;
  }> {
    try {
      const wallets = await this.walletRepo.findByAccount(this.accountId);
      const derivedBalances = await this.walletRepo.getDerivedBalances(this.accountId);
      return { wallets, derivedBalances };
    } catch (err) {
      logger.error('[DashboardService]', 'loadWalletsAndBalances error', err);
      return { wallets: [], derivedBalances: {} };
    }
  }

  private async loadUpcomingRecurring(): Promise<UpcomingRecurringItem | null> {
    try {
      const now = Date.now();
      const rows = await executeSql<{
        id: string;
        name: string;
        amount: number;
        next_run_date: number;
      }>(
        `SELECT id, name, amount, next_run_date
         FROM recurring_transactions
         WHERE is_active = 1 AND next_run_date >= ?
         ORDER BY next_run_date ASC LIMIT 1`,
        [now - 86400000],
      );

      if (rows.length === 0) return null;
      const item = rows[0];
      const diffMs = item.next_run_date - now;
      const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return {
        id: item.id,
        name: item.name,
        amount: Number(item.amount),
        daysUntil,
        formattedDate: format(new Date(item.next_run_date), 'MMM d'),
      };
    } catch {
      return null;
    }
  }

  private compute30DayTrend(allTransactions: Transaction[]): {
    points: CashFlow30DayPoint[];
    netChange: number;
  } {
    const now = new Date();
    const today = endOfDay(now).getTime();
    const thirtyDaysAgo = startOfDay(subDays(now, 29)).getTime();

    const dayMap = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < 30; i++) {
      const d = startOfDay(subDays(now, 29 - i));
      const key = format(d, 'yyyy-MM-dd');
      dayMap.set(key, { income: 0, expense: 0 });
    }

    for (const t of allTransactions) {
      if (t.date < thirtyDaysAgo || t.date > today) continue;
      if (t.type === 'transfer' || Boolean(t.destinationWalletId)) continue;
      const key = format(new Date(t.date), 'yyyy-MM-dd');
      const entry = dayMap.get(key);
      if (entry) {
        const amt = t.convertedAmount ?? t.amount;
        if (t.type === 'income') entry.income += amt;
        else if (t.type === 'expense') entry.expense += amt;
      }
    }

    let cumulative = 0;
    let totalNet = 0;
    const points: CashFlow30DayPoint[] = [];

    dayMap.forEach((values, dateStr) => {
      const delta = values.income - values.expense;
      cumulative += delta;
      totalNet += delta;
      const d = new Date(dateStr);
      points.push({
        date: dateStr,
        day: format(d, 'MMM d'),
        value: cumulative,
        income: values.income,
        expense: values.expense,
      });
    });

    return { points, netChange: totalNet };
  }
}
