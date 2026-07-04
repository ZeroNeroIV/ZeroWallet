// Goal Repository — extends BaseRepository
import { BaseRepository } from '../BaseRepository';
import type { Goal, GoalInput } from '../../types/models';
import type { FieldMapping } from '../types';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'accountId', column: 'account_id' },
  { field: 'name', column: 'name' },
  { field: 'targetAmount', column: 'target_amount' },
  { field: 'currentAmount', column: 'current_amount' },
  { field: 'fundingSource', column: 'funding_source' },
  { field: 'icon', column: 'icon' },
  { field: 'color', column: 'color' },
  { field: 'isCompleted', column: 'is_completed' },
  { field: 'completedAt', column: 'completed_at' },
  { field: 'monthlyContribution', column: 'monthly_contribution' },
  { field: 'targetDate', column: 'target_date' },
];

export class GoalRepository extends BaseRepository<Goal, GoalInput> {
  protected tableName = 'goals';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): Goal {
    return {
      id: row.id as string,
      accountId: row.account_id as string,
      name: row.name as string,
      targetAmount: row.target_amount as number | null,
      currentAmount: row.current_amount as number,
      fundingSource: row.funding_source as Goal['fundingSource'],
      icon: row.icon as string,
      color: row.color as string,
      isCompleted: (row.is_completed as number) === 1,
      completedAt: row.completed_at as number | null,
      monthlyContribution: (row.monthly_contribution as number) ?? null,
      targetDate: (row.target_date as number) ?? null,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async getActiveGoals(accountId: string): Promise<Goal[]> {
    return this.rawQuery(
      'SELECT * FROM goals WHERE account_id = ? AND is_completed = 0 ORDER BY created_at DESC',
      [accountId],
    );
  }

  async getCompletedGoals(accountId: string): Promise<Goal[]> {
    return this.rawQuery(
      'SELECT * FROM goals WHERE account_id = ? AND is_completed = 1 ORDER BY completed_at DESC',
      [accountId],
    );
  }

  async updateProgress(id: string, currentAmount: number): Promise<void> {
    await this.queryScalar(
      'UPDATE goals SET current_amount = ?, updated_at = ? WHERE id = ?',
      [currentAmount, Date.now(), id],
    );
  }

  async markCompleted(id: string): Promise<void> {
    const now = Date.now();
    await this.queryScalar(
      'UPDATE goals SET is_completed = 1, completed_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id],
    );
  }

  async reopenGoal(id: string): Promise<void> {
    await this.queryScalar(
      'UPDATE goals SET is_completed = 0, completed_at = NULL, updated_at = ? WHERE id = ?',
      [Date.now(), id],
    );
  }

  async getGoalsCount(accountId: string): Promise<{
    total: number;
    active: number;
    completed: number;
  }> {
    const rows = await this.queryScalar<{
      total: number;
      active: number;
      completed: number;
    }>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_completed = 0 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
       FROM goals WHERE account_id = ?`,
      [accountId],
    );
    const row = rows[0] || { total: 0, active: 0, completed: 0 };
    return {
      total: row.total || 0,
      active: row.active || 0,
      completed: row.completed || 0,
    };
  }

  async findByAccount(accountId: string): Promise<Goal[]> {
    return this.rawQuery(
      'SELECT * FROM goals WHERE account_id = ? ORDER BY is_completed ASC, created_at DESC',
      [accountId],
    );
  }
}
