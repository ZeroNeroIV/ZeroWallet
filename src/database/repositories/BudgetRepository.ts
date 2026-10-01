// Budget Repository — extends BaseRepository
import { BaseRepository } from '../BaseRepository';
import type { Budget, BudgetInput, BudgetStatus, Category } from '../../types/models';
import type { FieldMapping } from '../types';
import { executeSql } from '../index';
import { CategoryRepository } from './CategoryRepository';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'accountId', column: 'account_id' },
  { field: 'categoryId', column: 'category_id' },
  { field: 'amount', column: 'amount' },
  { field: 'period', column: 'period' },
  { field: 'rollover', column: 'rollover' },
];

export class BudgetRepository extends BaseRepository<Budget, BudgetInput> {
  protected tableName = 'budgets';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): Budget {
    return {
      id: row.id as string,
      accountId: (row.account_id ?? row.accountId) as string,
      categoryId: (row.category_id ?? row.categoryId) as string,
      amount: Number(row.amount) || 0,
      period: (row.period as Budget['period']) || 'monthly',
      rollover: (row.rollover as number) === 1 || row.rollover === true,
      createdAt: Number(row.created_at ?? row.createdAt) || Date.now(),
      updatedAt: Number(row.updated_at ?? row.updatedAt) || Date.now(),
    };
  }

  async findByAccount(accountId: string): Promise<Budget[]> {
    return this.rawQuery(
      'SELECT * FROM budgets WHERE account_id = ? ORDER BY created_at DESC',
      [accountId]
    );
  }

  async findByCategory(accountId: string, categoryId: string): Promise<Budget | null> {
    const rows = await this.rawQuery(
      'SELECT * FROM budgets WHERE account_id = ? AND category_id = ? LIMIT 1',
      [accountId, categoryId]
    );
    return rows[0] || null;
  }

  async getCategorySpending(
    accountId: string,
    categoryId: string,
    startDate: number,
    endDate: number
  ): Promise<number> {
    const rows = await executeSql<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE account_id = ?
         AND category_id = ?
         AND type = 'expense'
         AND date >= ?
         AND date <= ?`,
      [accountId, categoryId, startDate, endDate]
    );
    return rows[0]?.total ?? 0;
  }

  /**
   * Returns current budget statuses for an account for the given month/year.
   */
  async getBudgetStatuses(
    accountId: string,
    timestamp: number = Date.now()
  ): Promise<BudgetStatus[]> {
    const budgets = await this.findByAccount(accountId);
    if (budgets.length === 0) return [];

    const date = new Date(timestamp);
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    const categoryRepo = new CategoryRepository();
    const categories = await categoryRepo.findAll();
    const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

    const statuses: BudgetStatus[] = [];

    for (const budget of budgets) {
      let effectiveBudget = budget.amount;

      // Handle rollover from previous month if enabled
      if (budget.rollover) {
        const prevMonthStart = new Date(date.getFullYear(), date.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
        const prevMonthEnd = new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999).getTime();
        const prevSpent = await this.getCategorySpending(
          accountId,
          budget.categoryId,
          prevMonthStart,
          prevMonthEnd
        );
        const prevRollover = budget.amount - prevSpent;
        // If unspent, increase current effective budget
        if (prevRollover > 0) {
          effectiveBudget += prevRollover;
        }
      }

      const spent = await this.getCategorySpending(
        accountId,
        budget.categoryId,
        startOfMonth,
        endOfMonth
      );

      const remaining = Math.max(0, effectiveBudget - spent);
      const percentage = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0;

      statuses.push({
        budget: {
          ...budget,
          amount: effectiveBudget,
        },
        category: categoryMap.get(budget.categoryId),
        spent,
        remaining,
        percentage,
        isWarning: percentage >= 80 && percentage < 100,
        isExceeded: percentage >= 100,
      });
    }

    // Sort by percentage descending so highest risk budgets appear first
    return statuses.sort((a, b) => b.percentage - a.percentage);
  }
}
