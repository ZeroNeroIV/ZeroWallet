// Calendar Service — Multi-Horizon Occurrence Projector & Monthly Activity Aggregator
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  isToday,
  addMonths,
  subMonths,
  format,
  getDaysInMonth,
  getDay,
  differenceInDays,
} from 'date-fns';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { RecurringRepository } from '../../database/repositories/RecurringRepository';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import { syncBalancesFromDatabase } from '../walletTransferService';
import type {
  Transaction,
  RecurringTransaction,
  Subscription,
  RecurringExpense,
  Category,
  Wallet,
  VaultType,
} from '../../types/models';

export type CalendarItemType = 'transaction' | 'recurring' | 'subscription';

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  amount: number;
  date: number; // Unix timestamp in ms
  dateKey: string; // 'yyyy-MM-dd'
  category?: Category;
  walletName?: string;
  walletId?: string;

  // Transactions
  transactionType?: 'income' | 'expense' | 'transfer';
  isRecurringTx?: boolean;
  timeFormatted?: string;

  // Recurring & Subscriptions
  isSubscription?: boolean;
  isUpcoming?: boolean; // Due today or in the future and not yet marked paid
  isPaid?: boolean; // Paid or recorded
  frequencyLabel?: string; // 'MONTHLY', 'WEEKLY', etc.
  cadenceDescription?: string;
  daysUntil?: number; // 0 = today, >0 = future, <0 = past
  autoDeduct?: boolean;

  // Underlying model references
  transaction?: Transaction;
  recurring?: RecurringTransaction;
  legacySubscription?: Subscription;
  legacyRecurringExpense?: RecurringExpense;
}

export interface DayCalendarData {
  date: Date;
  dateKey: string; // 'yyyy-MM-dd'
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;

  // Aggregated items
  items: CalendarItem[];
  transactions: CalendarItem[];
  recurringItems: CalendarItem[];
  subscriptions: CalendarItem[];

  // Daily financial aggregates
  totalIncome: number;
  totalExpense: number;
  totalUpcomingBills: number;
  totalUpcomingSubs: number;
  netCashFlow: number; // totalIncome - totalExpense

  // Badges / Flags for calendar grid rendering
  hasIncome: boolean;
  hasExpense: boolean;
  hasRecurring: boolean;
  hasSubscription: boolean;
  hasUpcoming: boolean;
  hasPastDue: boolean;
}

export interface MonthCalendarData {
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  monthDate: Date;
  monthTitle: string; // 'OCTOBER 2026'
  currency: string;

  // Month-level totals
  totalIncome: number;
  totalExpense: number;
  totalUpcomingCommitments: number; // Remaining upcoming recurring bills + subscriptions
  projectedNet: number; // totalIncome - (totalExpense + totalUpcomingCommitments)

  // Calendar grid days (including padding days from prev and next month)
  gridDays: DayCalendarData[];

  // Fast lookup by 'yyyy-MM-dd'
  daysMap: Record<string, DayCalendarData>;
}

export class CalendarService {
  private txRepo: TransactionRepository;
  private catRepo: CategoryRepository;
  private walletRepo: WalletRepository;
  private accRepo: AccountRepository;
  private recurringRepo: RecurringRepository;
  private subRepo: SubscriptionRepository;
  private recExpenseRepo: RecurringExpenseRepository;

  constructor() {
    this.txRepo = new TransactionRepository();
    this.catRepo = new CategoryRepository();
    this.walletRepo = new WalletRepository();
    this.accRepo = new AccountRepository();
    this.recurringRepo = new RecurringRepository();
    this.subRepo = new SubscriptionRepository();
    this.recExpenseRepo = new RecurringExpenseRepository();
  }

  /**
   * Fetch all calendar data (transactions, recurring expenses, subscriptions) for a given month
   */
  async getMonthData(
    accountId: string,
    userId: string,
    targetDate: Date
  ): Promise<MonthCalendarData> {
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    const monthStartMs = monthStart.getTime();
    const monthEndMs = monthEnd.getTime();

    // 1. Parallel fetch of all relational repositories
    const [txs, cats, wallets, acc, recurringList, legacySubs, legacyRecs] =
      await Promise.all([
        this.txRepo.findByDateRange(accountId, monthStartMs, monthEndMs),
        this.catRepo.findByUser(userId),
        this.walletRepo.findByAccount(accountId),
        this.accRepo.findById(accountId),
        this.recurringRepo.findByAccount(accountId),
        this.subRepo.findByAccount(accountId).catch(() => []),
        this.recExpenseRepo.findByAccount(accountId).catch(() => []),
      ]);

    const currency = acc?.currency || 'USD';

    // 2. Maps for quick lookups
    const catMap = new Map<string, Category>();
    cats.forEach((c) => catMap.set(c.id, c));

    const walletMap = new Map<string, string>();
    wallets.forEach((w) => walletMap.set(w.id, w.name));

    // Map of dateKey -> CalendarItem[]
    const itemsByDate: Record<string, CalendarItem[]> = {};

    const addItemToDate = (dateKey: string, item: CalendarItem) => {
      if (!itemsByDate[dateKey]) {
        itemsByDate[dateKey] = [];
      }
      itemsByDate[dateKey].push(item);
    };

    // 3. Process logged transactions
    for (const tx of txs) {
      const txDate = new Date(tx.date);
      const dateKey = format(txDate, 'yyyy-MM-dd');
      const baseAmount = tx.convertedAmount ?? tx.amount;
      const isTransfer = tx.type === 'transfer' || !!tx.destinationWalletId;

      const item: CalendarItem = {
        id: tx.id,
        type: 'transaction',
        title: tx.description || (tx.type === 'income' ? 'Income' : isTransfer ? 'Transfer' : 'Expense'),
        amount: baseAmount,
        date: tx.date,
        dateKey,
        category: tx.categoryId ? catMap.get(tx.categoryId) : undefined,
        walletName: walletMap.get(tx.walletId || '') || tx.vaultType || '',
        walletId: tx.walletId,
        transactionType: tx.type,
        isRecurringTx: tx.isRecurring,
        timeFormatted: format(txDate, 'HH:mm'),
        transaction: tx,
      };

      addItemToDate(dateKey, item);
    }

    const todayStartMs = startOfDay(new Date()).getTime();
    const todayEndMs = endOfDay(new Date()).getTime();

    // Set of IDs already handled to prevent duplication between unified and legacy tables
    const handledTitles = new Set<string>();

    // 4. Project occurrences of Unified Recurring Transactions (both subscriptions & recurring bills)
    for (const rec of recurringList) {
      if (!rec.isActive) continue;
      handledTitles.add(rec.name.toLowerCase().trim());

      const occurrences = this.calculateOccurrencesInMonth(rec, monthStart, monthEnd);

      for (const occDate of occurrences) {
        const occMs = occDate.getTime();
        const dateKey = format(occDate, 'yyyy-MM-dd');

        // Check if past, today, or upcoming
        const isPast = occMs < todayStartMs;
        const isDueToday = occMs >= todayStartMs && occMs <= todayEndMs;
        const isUpcoming = occMs > todayEndMs || isDueToday;

        // Check if there is an actual transaction logged for this recurring item on or around this date
        const matchingTx = txs.find((t) => {
          const tDateKey = format(new Date(t.date), 'yyyy-MM-dd');
          if (tDateKey !== dateKey) return false;
          if (t.recurringExpenseId === rec.id || t.subscriptionId === rec.id) return true;
          if (t.isRecurring && t.description?.toLowerCase().includes(rec.name.toLowerCase())) return true;
          return false;
        });

        const isPaid = !!matchingTx || (rec.lastRunDate ? Math.abs(rec.lastRunDate - occMs) < 86400000 : false);

        const daysUntil = isDueToday
          ? 0
          : isPast
          ? -differenceInDays(new Date(), occDate)
          : differenceInDays(occDate, new Date());

        const isSub = rec.isSubscription;

        const item: CalendarItem = {
          id: `${rec.id}-${dateKey}`,
          type: isSub ? 'subscription' : 'recurring',
          title: rec.name,
          amount: rec.amount,
          date: occMs,
          dateKey,
          category: rec.categoryId ? catMap.get(rec.categoryId) : undefined,
          walletName: walletMap.get(rec.walletId) || rec.walletId,
          walletId: rec.walletId,
          isSubscription: isSub,
          isUpcoming: !isPaid && (isUpcoming || isDueToday),
          isPaid,
          frequencyLabel: rec.frequencyUnit.toUpperCase(),
          cadenceDescription: this.formatCadence(rec.frequencyUnit, rec.frequencyInterval),
          daysUntil,
          autoDeduct: rec.autoDeduct,
          recurring: rec,
        };

        addItemToDate(dateKey, item);
      }
    }

    // 5. Process Legacy Subscriptions (if any not already in handledTitles)
    for (const sub of legacySubs) {
      if (!sub.isActive) continue;
      if (handledTitles.has(sub.name.toLowerCase().trim())) continue;
      handledTitles.add(sub.name.toLowerCase().trim());

      const daysInTargetMonth = getDaysInMonth(monthStart);
      const effectiveDay = Math.min(sub.billingDay, daysInTargetMonth);
      const occDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), effectiveDay, 12, 0, 0);
      const occMs = occDate.getTime();
      const dateKey = format(occDate, 'yyyy-MM-dd');

      const isPast = occMs < todayStartMs;
      const isDueToday = occMs >= todayStartMs && occMs <= todayEndMs;
      const isUpcoming = occMs > todayEndMs || isDueToday;

      const isPaid = sub.lastProcessed ? Math.abs(sub.lastProcessed - occMs) < 86400000 : false;
      const daysUntil = isDueToday
        ? 0
        : isPast
        ? -differenceInDays(new Date(), occDate)
        : differenceInDays(occDate, new Date());

      const item: CalendarItem = {
        id: `legacy-sub-${sub.id}-${dateKey}`,
        type: 'subscription',
        title: sub.name,
        amount: sub.amount,
        date: occMs,
        dateKey,
        category: sub.categoryId ? catMap.get(sub.categoryId) : undefined,
        walletName: walletMap.get(sub.vaultType) || sub.vaultType,
        walletId: sub.vaultType,
        isSubscription: true,
        isUpcoming: !isPaid && (isUpcoming || isDueToday),
        isPaid,
        frequencyLabel: 'MONTHLY',
        cadenceDescription: `Every month on day ${sub.billingDay}`,
        daysUntil,
        legacySubscription: sub,
      };

      addItemToDate(dateKey, item);
    }

    // 6. Process Legacy Recurring Expenses (if any not already handled)
    for (const rec of legacyRecs) {
      if (!rec.isActive) continue;
      if (handledTitles.has(rec.name.toLowerCase().trim())) continue;
      handledTitles.add(rec.name.toLowerCase().trim());

      const occurrences = this.calculateLegacyRecOccurrencesInMonth(rec, monthStart, monthEnd);

      for (const occDate of occurrences) {
        const occMs = occDate.getTime();
        const dateKey = format(occDate, 'yyyy-MM-dd');

        const isPast = occMs < todayStartMs;
        const isDueToday = occMs >= todayStartMs && occMs <= todayEndMs;
        const isUpcoming = occMs > todayEndMs || isDueToday;

        const isPaid = rec.lastProcessed ? Math.abs(rec.lastProcessed - occMs) < 86400000 : false;
        const daysUntil = isDueToday
          ? 0
          : isPast
          ? -differenceInDays(new Date(), occDate)
          : differenceInDays(occDate, new Date());

        const item: CalendarItem = {
          id: `legacy-rec-${rec.id}-${dateKey}`,
          type: 'recurring',
          title: rec.name,
          amount: rec.amount,
          date: occMs,
          dateKey,
          category: rec.categoryId ? catMap.get(rec.categoryId) : undefined,
          walletName: walletMap.get(rec.vaultType) || rec.vaultType,
          walletId: rec.vaultType,
          isSubscription: false,
          isUpcoming: !isPaid && (isUpcoming || isDueToday),
          isPaid,
          frequencyLabel: rec.frequency.toUpperCase(),
          cadenceDescription: `Every ${rec.interval > 1 ? `${rec.interval} ` : ''}${rec.frequency}`,
          daysUntil,
          autoDeduct: rec.autoDeduct,
          legacyRecurringExpense: rec,
        };

        addItemToDate(dateKey, item);
      }
    }

    // 7. Build Grid Days (Calendar Grid Structure)
    const daysInMonthCount = getDaysInMonth(targetDate);
    const firstDayWeekday = getDay(monthStart); // 0 = Sunday, 1 = Monday, ... 6 = Saturday

    const gridDays: DayCalendarData[] = [];
    const daysMap: Record<string, DayCalendarData> = {};

    // 7a. Leading days from previous month
    const prevMonth = subMonths(targetDate, 1);
    const prevMonthDays = getDaysInMonth(prevMonth);
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const d = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), dayNum, 12, 0, 0);
      const dKey = format(d, 'yyyy-MM-dd');
      const dayData = this.buildDayCalendarData(d, dKey, dayNum, false, itemsByDate[dKey] || []);
      gridDays.push(dayData);
      daysMap[dKey] = dayData;
    }

    // 7b. Current month days
    for (let dayNum = 1; dayNum <= daysInMonthCount; dayNum++) {
      const d = new Date(targetDate.getFullYear(), targetDate.getMonth(), dayNum, 12, 0, 0);
      const dKey = format(d, 'yyyy-MM-dd');
      const dayData = this.buildDayCalendarData(d, dKey, dayNum, true, itemsByDate[dKey] || []);
      gridDays.push(dayData);
      daysMap[dKey] = dayData;
    }

    // 7c. Trailing days from next month to complete the 7-column grid
    const remainder = gridDays.length % 7;
    if (remainder !== 0) {
      const trailingCount = 7 - remainder;
      const nextMonth = addMonths(targetDate, 1);
      for (let dayNum = 1; dayNum <= trailingCount; dayNum++) {
        const d = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), dayNum, 12, 0, 0);
        const dKey = format(d, 'yyyy-MM-dd');
        const dayData = this.buildDayCalendarData(d, dKey, dayNum, false, itemsByDate[dKey] || []);
        gridDays.push(dayData);
        daysMap[dKey] = dayData;
      }
    }

    // 8. Calculate Monthly Metrics
    let totalIncome = 0;
    let totalExpense = 0;
    let totalUpcomingCommitments = 0;

    for (const day of gridDays) {
      if (!day.isCurrentMonth) continue;
      totalIncome += day.totalIncome;
      totalExpense += day.totalExpense;
      totalUpcomingCommitments += day.totalUpcomingBills + day.totalUpcomingSubs;
    }

    const projectedNet = totalIncome - (totalExpense + totalUpcomingCommitments);

    return {
      year: targetDate.getFullYear(),
      month: targetDate.getMonth(),
      monthDate: targetDate,
      monthTitle: format(targetDate, 'MMMM yyyy').toUpperCase(),
      currency,
      totalIncome,
      totalExpense,
      totalUpcomingCommitments,
      projectedNet,
      gridDays,
      daysMap,
    };
  }

  /**
   * Constructs DayCalendarData with computed summary amounts and badge flags
   */
  private buildDayCalendarData(
    date: Date,
    dateKey: string,
    dayNumber: number,
    isCurrentMonth: boolean,
    items: CalendarItem[]
  ): DayCalendarData {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalUpcomingBills = 0;
    let totalUpcomingSubs = 0;

    const transactions: CalendarItem[] = [];
    const recurringItems: CalendarItem[] = [];
    const subscriptions: CalendarItem[] = [];

    let hasIncome = false;
    let hasExpense = false;
    let hasRecurring = false;
    let hasSubscription = false;
    let hasUpcoming = false;
    let hasPastDue = false;

    for (const item of items) {
      if (item.type === 'transaction') {
        transactions.push(item);
        if (item.transactionType === 'income') {
          totalIncome += item.amount;
          hasIncome = true;
        } else if (item.transactionType === 'expense') {
          totalExpense += item.amount;
          hasExpense = true;
        }
      } else if (item.type === 'subscription') {
        subscriptions.push(item);
        hasSubscription = true;
        if (item.isUpcoming) {
          totalUpcomingSubs += item.amount;
          hasUpcoming = true;
        } else if (!item.isPaid && (item.daysUntil ?? 0) < 0) {
          hasPastDue = true;
        }
      } else if (item.type === 'recurring') {
        recurringItems.push(item);
        hasRecurring = true;
        if (item.isUpcoming) {
          totalUpcomingBills += item.amount;
          hasUpcoming = true;
        } else if (!item.isPaid && (item.daysUntil ?? 0) < 0) {
          hasPastDue = true;
        }
      }
    }

    return {
      date,
      dateKey,
      dayNumber,
      isCurrentMonth,
      isToday: isToday(date),
      items,
      transactions,
      recurringItems,
      subscriptions,
      totalIncome,
      totalExpense,
      totalUpcomingBills,
      totalUpcomingSubs,
      netCashFlow: totalIncome - totalExpense,
      hasIncome,
      hasExpense,
      hasRecurring,
      hasSubscription,
      hasUpcoming,
      hasPastDue,
    };
  }

  /**
   * Projects occurrence dates for a unified RecurringTransaction within [monthStart, monthEnd]
   */
  private calculateOccurrencesInMonth(
    item: RecurringTransaction,
    monthStart: Date,
    monthEnd: Date
  ): Date[] {
    const dates: Date[] = [];
    const monthStartMs = monthStart.getTime();
    const monthEndMs = monthEnd.getTime();

    if (item.startDate > monthEndMs) return dates;
    if (item.endDate && item.endDate < monthStartMs) return dates;

    const interval = Math.max(1, item.frequencyInterval || 1);
    const startDate = new Date(item.startDate);

    switch (item.frequencyUnit) {
      case 'month': {
        const diffMonths =
          (monthStart.getFullYear() - startDate.getFullYear()) * 12 +
          (monthStart.getMonth() - startDate.getMonth());

        if (diffMonths >= 0 && diffMonths % interval === 0) {
          const targetDay =
            item.billingDay && item.billingDay >= 1 && item.billingDay <= 31
              ? item.billingDay
              : startDate.getDate();
          const daysInMonth = getDaysInMonth(monthStart);
          const effectiveDay = Math.min(targetDay, daysInMonth);
          const occDate = new Date(
            monthStart.getFullYear(),
            monthStart.getMonth(),
            effectiveDay,
            12,
            0,
            0
          );

          if (
            occDate.getTime() >= item.startDate &&
            (!item.endDate || occDate.getTime() <= item.endDate)
          ) {
            dates.push(occDate);
          }
        }
        break;
      }

      case 'week': {
        const intervalMs = interval * 7 * 24 * 60 * 60 * 1000;
        let currMs = item.startDate;

        if (currMs < monthStartMs) {
          const elapsed = monthStartMs - currMs;
          const skipCount = Math.floor(elapsed / intervalMs);
          currMs += skipCount * intervalMs;
          if (currMs < monthStartMs) currMs += intervalMs;
        }

        while (currMs <= monthEndMs) {
          if (!item.endDate || currMs <= item.endDate) {
            dates.push(new Date(currMs));
          }
          currMs += intervalMs;
        }
        break;
      }

      case 'day': {
        const intervalMs = interval * 24 * 60 * 60 * 1000;
        let currMs = item.startDate;

        if (currMs < monthStartMs) {
          const elapsed = monthStartMs - currMs;
          const skipCount = Math.floor(elapsed / intervalMs);
          currMs += skipCount * intervalMs;
          if (currMs < monthStartMs) currMs += intervalMs;
        }

        while (currMs <= monthEndMs) {
          if (!item.endDate || currMs <= item.endDate) {
            dates.push(new Date(currMs));
          }
          currMs += intervalMs;
        }
        break;
      }

      case 'year': {
        if (startDate.getMonth() === monthStart.getMonth()) {
          const yearDiff = monthStart.getFullYear() - startDate.getFullYear();
          if (yearDiff >= 0 && yearDiff % interval === 0) {
            const effectiveDay = Math.min(startDate.getDate(), getDaysInMonth(monthStart));
            const occDate = new Date(
              monthStart.getFullYear(),
              monthStart.getMonth(),
              effectiveDay,
              12,
              0,
              0
            );

            if (
              occDate.getTime() >= item.startDate &&
              (!item.endDate || occDate.getTime() <= item.endDate)
            ) {
              dates.push(occDate);
            }
          }
        }
        break;
      }
    }

    return dates;
  }

  /**
   * Projects occurrence dates for legacy RecurringExpense within [monthStart, monthEnd]
   */
  private calculateLegacyRecOccurrencesInMonth(
    rec: RecurringExpense,
    monthStart: Date,
    monthEnd: Date
  ): Date[] {
    const dates: Date[] = [];
    const interval = Math.max(1, rec.interval || 1);
    const startDate = new Date(rec.createdAt || rec.nextOccurrence);

    switch (rec.frequency) {
      case 'monthly': {
        const diffMonths =
          (monthStart.getFullYear() - startDate.getFullYear()) * 12 +
          (monthStart.getMonth() - startDate.getMonth());
        if (diffMonths >= 0 && diffMonths % interval === 0) {
          const day = Math.min(startDate.getDate(), getDaysInMonth(monthStart));
          dates.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 12, 0, 0));
        }
        break;
      }
      case 'weekly': {
        const intervalMs = interval * 7 * 24 * 60 * 60 * 1000;
        let currMs = startDate.getTime();
        if (currMs < monthStart.getTime()) {
          const elapsed = monthStart.getTime() - currMs;
          currMs += Math.floor(elapsed / intervalMs) * intervalMs;
          if (currMs < monthStart.getTime()) currMs += intervalMs;
        }
        while (currMs <= monthEnd.getTime()) {
          dates.push(new Date(currMs));
          currMs += intervalMs;
        }
        break;
      }
      case 'daily': {
        const intervalMs = interval * 24 * 60 * 60 * 1000;
        let currMs = startDate.getTime();
        if (currMs < monthStart.getTime()) {
          const elapsed = monthStart.getTime() - currMs;
          currMs += Math.floor(elapsed / intervalMs) * intervalMs;
          if (currMs < monthStart.getTime()) currMs += intervalMs;
        }
        while (currMs <= monthEnd.getTime()) {
          dates.push(new Date(currMs));
          currMs += intervalMs;
        }
        break;
      }
      case 'yearly': {
        if (startDate.getMonth() === monthStart.getMonth()) {
          const yearDiff = monthStart.getFullYear() - startDate.getFullYear();
          if (yearDiff >= 0 && yearDiff % interval === 0) {
            const day = Math.min(startDate.getDate(), getDaysInMonth(monthStart));
            dates.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 12, 0, 0));
          }
        }
        break;
      }
    }

    return dates;
  }

  private formatCadence(unit: string, interval: number): string {
    if (interval === 1) {
      switch (unit) {
        case 'day':
          return 'Daily';
        case 'week':
          return 'Weekly';
        case 'month':
          return 'Monthly';
        case 'year':
          return 'Yearly';
        default:
          return unit;
      }
    }
    return `Every ${interval} ${unit}s`;
  }

  /**
   * Execute manual payment for a recurring commitment and advance its schedule
   */
  async payRecurringItem(
    accountId: string,
    item: CalendarItem,
    accountCurrency: string
  ): Promise<void> {
    const now = Date.now();
    const isIncome = item.recurring?.type === 'income';

    // 1. Record the transaction in database
    await this.txRepo.create({
      accountId,
      type: isIncome ? 'income' : 'expense',
      amount: item.amount,
      categoryId: item.category?.id || item.recurring?.categoryId || '',
      description: `${item.title} (Recurring Payment)`,
      date: now,
      vaultType: (item.walletId || 'main') as VaultType,
      walletId: item.walletId || 'main',
      isRecurring: true,
      currency: accountCurrency,
    });

    // 2. Advance the schedule in RecurringRepository if applicable
    if (item.recurring) {
      const nextDate = this.recurringRepo.calculateNextRunDate(
        item.recurring.nextRunDate,
        item.recurring.frequencyUnit,
        item.recurring.frequencyInterval,
        item.recurring.billingDay
      );

      await this.recurringRepo.update(item.recurring.id, {
        lastRunDate: now,
        nextRunDate: nextDate,
      });
    } else if (item.legacySubscription) {
      await this.subRepo.update(item.legacySubscription.id, {
        lastProcessed: now,
      });
    } else if (item.legacyRecurringExpense) {
      await this.recExpenseRepo.update(item.legacyRecurringExpense.id, {
        lastProcessed: now,
      });
    }

    // 3. Keep wallet balances in sync
    await syncBalancesFromDatabase(accountId);
  }
}
