// Budget Repository — extends BaseRepository
import { executeSql } from '../index';
import { BaseRepository } from '../BaseRepository';
import type { Budget, BudgetInput } from '../../types/models';
import type { FieldMapping } from '../types';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'accountId', column: 'account_id' },
  { field: 'categoryId', column: 'category_id' },
  { field: 'month', column: 'month' },
  { field: 'amountLimit', column: 'amount_limit' },
];

export class BudgetRepository extends BaseRepository<Budget, BudgetInput> {
  protected tableName = 'budgets';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): Budget {
    return {
      id: row.id as string,
      accountId: row.account_id as string,
      categoryId: row.category_id as string,
      month: row.month as string,
      amountLimit: row.amount_limit as number,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async findByAccountAndMonth(accountId: string, month: string): Promise<Budget[]> {
    return this.rawQuery(
      'SELECT * FROM budgets WHERE account_id = ? AND month = ?',
      [accountId, month],
    );
  }

  async findOne(accountId: string, categoryId: string, month: string): Promise<Budget | null> {
    const rows = await this.rawQuery(
      'SELECT * FROM budgets WHERE account_id = ? AND category_id = ? AND month = ?',
      [accountId, categoryId, month],
    );
    return rows[0] || null;
  }

  async upsert(
    accountId: string,
    categoryId: string,
    month: string,
    amountLimit: number,
  ): Promise<Budget> {
    const existing = await this.findOne(accountId, categoryId, month);
    if (existing) {
      await this.update(existing.id, { amountLimit });
      return (await this.findById(existing.id)) as Budget;
    }
    return this.create({ accountId, categoryId, month, amountLimit });
  }

  async deleteForCategoryMonth(accountId: string, categoryId: string, month: string): Promise<void> {
    await executeSql(
      'DELETE FROM budgets WHERE account_id = ? AND category_id = ? AND month = ?',
      [accountId, categoryId, month],
    );
  }
}
