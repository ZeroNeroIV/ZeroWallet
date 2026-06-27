// Debt Repository — extends BaseRepository
import { BaseRepository } from '../BaseRepository';
import type { Debt, DebtInput, DebtStats } from '../../types/models';
import type { FieldMapping } from '../types';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'accountId', column: 'account_id' },
  { field: 'type', column: 'type' },
  { field: 'personName', column: 'person_name' },
  { field: 'amount', column: 'amount' },
  { field: 'amountPaid', column: 'amount_paid' },
  { field: 'dueDate', column: 'due_date' },
  { field: 'status', column: 'status' },
  { field: 'description', column: 'description' },
  { field: 'categoryId', column: 'category_id' },
];

export class DebtRepository extends BaseRepository<Debt, DebtInput> {
  protected tableName = 'debts';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): Debt {
    return {
      id: row.id as string,
      accountId: row.account_id as string,
      type: row.type as Debt['type'],
      personName: row.person_name as string,
      amount: row.amount as number,
      amountPaid: row.amount_paid as number,
      dueDate: row.due_date as number,
      status: row.status as Debt['status'],
      description: (row.description as string) || '',
      categoryId: row.category_id as string | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async create(data: DebtInput): Promise<Debt> {
    const paid = data.amountPaid || 0;
    const status = paid >= data.amount ? 'paid' : paid > 0 ? 'partial' : 'pending';
    const id = await this.insert(data as unknown as Record<string, unknown>, {
      status,
    });
    return (await this.findById(id)) as Debt;
  }

  async getDebtsByType(accountId: string, type: 'lent' | 'borrowed'): Promise<Debt[]> {
    return this.rawQuery(
      'SELECT * FROM debts WHERE account_id = ? AND type = ? ORDER BY status ASC, due_date ASC',
      [accountId, type],
    );
  }

  async getPendingDebts(accountId: string): Promise<Debt[]> {
    return this.rawQuery(
      "SELECT * FROM debts WHERE account_id = ? AND status IN ('pending', 'partial') ORDER BY due_date ASC",
      [accountId],
    );
  }

  async getOverdueDebts(accountId: string): Promise<Debt[]> {
    return this.rawQuery(
      "SELECT * FROM debts WHERE account_id = ? AND status IN ('pending', 'partial') AND due_date < ? ORDER BY due_date ASC",
      [accountId, Date.now()],
    );
  }

  async recordPayment(id: string, paymentAmount: number): Promise<void> {
    const debt = await this.findById(id);
    if (!debt) throw new Error('Debt not found');
    const newAmountPaid = debt.amountPaid + paymentAmount;
    const newStatus = newAmountPaid >= debt.amount ? 'paid' : newAmountPaid > 0 ? 'partial' : 'pending';
    await this.queryScalar(
      'UPDATE debts SET amount_paid = ?, status = ?, updated_at = ? WHERE id = ?',
      [newAmountPaid, newStatus, Date.now(), id],
    );
  }

  async markAsPaid(id: string): Promise<void> {
    await this.queryScalar(
      "UPDATE debts SET amount_paid = amount, status = 'paid', updated_at = ? WHERE id = ?",
      [Date.now(), id],
    );
  }

  async getDebtStats(accountId: string): Promise<DebtStats> {
    const lent = await this.queryScalar<{
      total_outstanding: number;
      total_paid: number;
      pending_count: number;
    }>(
      `SELECT
        SUM(CASE WHEN status IN ('pending', 'partial') THEN amount - amount_paid ELSE 0 END) as total_outstanding,
        SUM(amount_paid) as total_paid,
        COUNT(CASE WHEN status IN ('pending', 'partial') THEN 1 END) as pending_count
       FROM debts WHERE account_id = ? AND type = 'lent'`,
      [accountId],
    );

    const borrowed = await this.queryScalar<{
      total_outstanding: number;
      total_paid: number;
      pending_count: number;
    }>(
      `SELECT
        SUM(CASE WHEN status IN ('pending', 'partial') THEN amount - amount_paid ELSE 0 END) as total_outstanding,
        SUM(amount_paid) as total_paid,
        COUNT(CASE WHEN status IN ('pending', 'partial') THEN 1 END) as pending_count
       FROM debts WHERE account_id = ? AND type = 'borrowed'`,
      [accountId],
    );

    const overdue = await this.queryScalar<{ count: number }>(
      "SELECT COUNT(*) as count FROM debts WHERE account_id = ? AND status IN ('pending', 'partial') AND due_date < ?",
      [accountId, Date.now()],
    );

    return {
      totalLent: (lent[0]?.total_outstanding) || 0,
      totalBorrowed: (borrowed[0]?.total_outstanding) || 0,
      totalLentPaid: (lent[0]?.total_paid) || 0,
      totalBorrowedPaid: (borrowed[0]?.total_paid) || 0,
      overdueCount: (overdue[0]?.count) || 0,
      pendingLentCount: (lent[0]?.pending_count) || 0,
      pendingBorrowedCount: (borrowed[0]?.pending_count) || 0,
    };
  }

  async findByAccount(accountId: string): Promise<Debt[]> {
    return this.rawQuery(
      'SELECT * FROM debts WHERE account_id = ? ORDER BY status ASC, due_date ASC',
      [accountId],
    );
  }
}
