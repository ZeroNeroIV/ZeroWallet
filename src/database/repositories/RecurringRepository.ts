// Unified Recurring Repository — Subscriptions & Recurring Expenses
import { executeSql } from '../index';
import { BaseRepository } from '../BaseRepository';
import type { RecurringTransaction, RecurringTransactionInput } from '../../types/models';
import type { FieldMapping } from '../types';
import { addDays, addWeeks, addMonths, addYears, setDate } from 'date-fns';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'walletId', column: 'wallet_id' },
  { field: 'destinationWalletId', column: 'destination_wallet_id' },
  { field: 'name', column: 'name' },
  { field: 'type', column: 'type' },
  { field: 'amount', column: 'amount' },
  { field: 'categoryId', column: 'category_id' },
  { field: 'frequencyUnit', column: 'frequency_unit' },
  { field: 'frequencyInterval', column: 'frequency_interval' },
  { field: 'billingDay', column: 'billing_day' },
  { field: 'startDate', column: 'start_date' },
  { field: 'endDate', column: 'end_date' },
  { field: 'nextRunDate', column: 'next_run_date' },
  { field: 'lastRunDate', column: 'last_run_date' },
  { field: 'autoDeduct', column: 'auto_deduct' },
  { field: 'reminderDaysBefore', column: 'reminder_days_before' },
  { field: 'isSubscription', column: 'is_subscription' },
  { field: 'isActive', column: 'is_active' },
];

export class RecurringRepository extends BaseRepository<RecurringTransaction> {
  protected tableName = 'recurring_transactions';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): RecurringTransaction {
    return {
      id: row.id as string,
      walletId: row.wallet_id as string,
      destinationWalletId: (row.destination_wallet_id as string) || null,
      name: row.name as string,
      type: (row.type as 'expense' | 'income' | 'transfer') || 'expense',
      amount: Number(row.amount) || 0,
      categoryId: (row.category_id as string) || null,
      frequencyUnit: (row.frequency_unit as 'day' | 'week' | 'month' | 'year') || 'month',
      frequencyInterval: Number(row.frequency_interval) || 1,
      billingDay: row.billing_day != null ? Number(row.billing_day) : null,
      startDate: Number(row.start_date) || Date.now(),
      endDate: row.end_date != null ? Number(row.end_date) : null,
      nextRunDate: Number(row.next_run_date) || Date.now(),
      lastRunDate: row.last_run_date != null ? Number(row.last_run_date) : null,
      autoDeduct: (row.auto_deduct as number) === 1,
      reminderDaysBefore: Number(row.reminder_days_before) ?? 1,
      isSubscription: (row.is_subscription as number) === 1,
      isActive: (row.is_active as number) === 1,
      createdAt: Number(row.created_at) || Date.now(),
      updatedAt: Number(row.updated_at) || Date.now(),
    };
  }

  async findAllActive(): Promise<RecurringTransaction[]> {
    return this.rawQuery(
      'SELECT * FROM recurring_transactions WHERE is_active = 1 ORDER BY next_run_date ASC'
    );
  }

  async findByAccount(accountId: string): Promise<RecurringTransaction[]> {
    return this.rawQuery(
      `SELECT r.* FROM recurring_transactions r
       JOIN wallets w ON w.id = r.wallet_id
       WHERE w.account_id = ?
       ORDER BY r.next_run_date ASC`,
      [accountId]
    );
  }

  async findByWallet(walletId: string): Promise<RecurringTransaction[]> {
    return this.rawQuery(
      'SELECT * FROM recurring_transactions WHERE wallet_id = ? ORDER BY next_run_date ASC',
      [walletId]
    );
  }

  async findUpcoming(limit: number = 3): Promise<RecurringTransaction[]> {
    const now = Date.now();
    return this.rawQuery(
      'SELECT * FROM recurring_transactions WHERE is_active = 1 ORDER BY next_run_date ASC LIMIT ?',
      [limit]
    );
  }

  /**
   * Purpose: Mathematically normalizes any arbitrary cadence (days, weeks, months, years)
   * into a standardized monthly equivalent amount for burn rate calculations.
   */
  getMonthlyEquivalent(item: RecurringTransaction): number {
    const interval = Math.max(1, item.frequencyInterval || 1);
    switch (item.frequencyUnit) {
      case 'day':
        return (item.amount * 30.4375) / interval;
      case 'week':
        return (item.amount * 52) / (12 * interval);
      case 'month':
        return item.amount / interval;
      case 'year':
        return item.amount / (12 * interval);
      default:
        return item.amount;
    }
  }

  /**
   * Calculates the next occurrence date given a current anchor date and cadence parameters
   */
  calculateNextRunDate(
    currentRunDate: number,
    unit: 'day' | 'week' | 'month' | 'year',
    interval: number = 1,
    billingDay?: number | null
  ): number {
    const fromDate = new Date(currentRunDate);
    let nextDate: Date;

    switch (unit) {
      case 'day':
        nextDate = addDays(fromDate, interval);
        break;
      case 'week':
        nextDate = addWeeks(fromDate, interval);
        break;
      case 'month':
        nextDate = addMonths(fromDate, interval);
        if (billingDay && billingDay >= 1 && billingDay <= 31) {
          nextDate = setDate(nextDate, billingDay);
        }
        break;
      case 'year':
        nextDate = addYears(fromDate, interval);
        break;
      default:
        nextDate = addMonths(fromDate, 1);
    }

    return nextDate.getTime();
  }
}
