// Recurring Expense Repository — extends BaseRepository
import { BaseRepository } from '../BaseRepository';
import type { RecurringExpense, RecurringExpenseInput, RecurringFrequency } from '../../types/models';
import type { FieldMapping } from '../types';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'accountId', column: 'account_id' },
  { field: 'name', column: 'name' },
  { field: 'amount', column: 'amount' },
  { field: 'categoryId', column: 'category_id' },
  { field: 'frequency', column: 'frequency' },
  { field: 'interval', column: 'interval' },
  { field: 'nextOccurrence', column: 'next_occurrence' },
  { field: 'vaultType', column: 'vault_type' },
  { field: 'isActive', column: 'is_active' },
  { field: 'autoDeduct', column: 'auto_deduct' },
  { field: 'lastProcessed', column: 'last_processed' },
];

export class RecurringExpenseRepository extends BaseRepository<RecurringExpense, RecurringExpenseInput> {
  protected tableName = 'recurring_expenses';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): RecurringExpense {
    return {
      id: row.id as string,
      accountId: row.account_id as string,
      name: row.name as string,
      amount: row.amount as number,
      categoryId: row.category_id as string,
      frequency: row.frequency as RecurringFrequency,
      interval: row.interval as number,
      nextOccurrence: row.next_occurrence as number,
      vaultType: row.vault_type as RecurringExpense['vaultType'],
      isActive: (row.is_active as number) === 1,
      autoDeduct: (row.auto_deduct as number) === 1,
      lastProcessed: row.last_processed as number | null,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async findActiveByAccount(accountId: string): Promise<RecurringExpense[]> {
    return this.rawQuery(
      'SELECT * FROM recurring_expenses WHERE account_id = ? AND is_active = 1 ORDER BY name ASC',
      [accountId],
    );
  }

  async findDue(): Promise<RecurringExpense[]> {
    return this.rawQuery(
      'SELECT * FROM recurring_expenses WHERE is_active = 1 AND next_occurrence <= ?',
      [Date.now()],
    );
  }

  async findOverdue(): Promise<RecurringExpense[]> {
    return this.rawQuery(
      'SELECT * FROM recurring_expenses WHERE is_active = 1 AND next_occurrence < ? ORDER BY next_occurrence ASC',
      [Date.now()],
    );
  }

  async markAsProcessed(id: string): Promise<void> {
    const expense = await this.findById(id);
    if (!expense) throw new Error('Recurring expense not found');
    const now = Date.now();
    const nextOccurrence = this.calculateNextOccurrence(
      expense.nextOccurrence,
      expense.frequency,
      expense.interval,
    );
    await this.queryScalar(
      'UPDATE recurring_expenses SET last_processed = ?, next_occurrence = ?, updated_at = ? WHERE id = ?',
      [now, nextOccurrence, now, id],
    );
  }

  private calculateNextOccurrence(
    currentOccurrence: number,
    frequency: RecurringFrequency,
    interval: number,
  ): number {
    const date = new Date(currentOccurrence);
    switch (frequency) {
      case 'daily':   date.setDate(date.getDate() + interval); break;
      case 'weekly':  date.setDate(date.getDate() + interval * 7); break;
      case 'monthly': date.setMonth(date.getMonth() + interval); break;
      case 'yearly':  date.setFullYear(date.getFullYear() + interval); break;
    }
    return date.getTime();
  }

  async findByAccount(accountId: string): Promise<RecurringExpense[]> {
    return this.rawQuery(
      'SELECT * FROM recurring_expenses WHERE account_id = ? ORDER BY is_active DESC, name ASC',
      [accountId],
    );
  }
}
