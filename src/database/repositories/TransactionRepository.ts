// Transaction Repository — extends BaseRepository
import { v4 as uuidv4 } from 'uuid';
import { executeSql } from '../index';
import { BaseRepository } from '../BaseRepository';
import type { Transaction, TransactionInput } from '../../types/models';
import type { FieldMapping } from '../types';
import { deleteTransactionImage } from '../../utils/imageStorage';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'accountId', column: 'account_id' },
  { field: 'type', column: 'type' },
  { field: 'amount', column: 'amount' },
  { field: 'categoryId', column: 'category_id' },
  { field: 'description', column: 'description' },
  { field: 'date', column: 'date' },
  { field: 'vaultType', column: 'vault_type' },
  { field: 'isRecurring', column: 'is_recurring' },
  { field: 'recurringExpenseId', column: 'recurring_expense_id' },
  { field: 'subscriptionId', column: 'subscription_id' },
  { field: 'imagePath', column: 'image_path' },
  { field: 'currency', column: 'currency' },
  { field: 'originalAmount', column: 'original_amount' },
  { field: 'exchangeRate', column: 'exchange_rate' },
  { field: 'convertedAmount', column: 'converted_amount' },
];

export class TransactionRepository extends BaseRepository<Transaction, TransactionInput> {
  protected tableName = 'transactions';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): Transaction {
    return {
      id: row.id as string,
      accountId: row.account_id as string,
      type: row.type as Transaction['type'],
      amount: row.amount as number,
      categoryId: row.category_id as string,
      description: row.description as string,
      date: row.date as number,
      vaultType: row.vault_type as Transaction['vaultType'],
      isRecurring: (row.is_recurring as number) === 1,
      recurringExpenseId: row.recurring_expense_id as string | undefined,
      subscriptionId: row.subscription_id as string | undefined,
      imagePath: row.image_path as string | undefined,
      currency: (row.currency as string) || 'USD',
      originalAmount: row.original_amount as number | undefined,
      exchangeRate: row.exchange_rate as number | undefined,
      convertedAmount: row.converted_amount as number | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async findByAccount(accountId: string, limit?: number): Promise<Transaction[]> {
    if (limit) {
      return this.rawQuery(
        'SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC, created_at DESC LIMIT ?',
        [accountId, limit],
      );
    }
    return this.rawQuery(
      'SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC, created_at DESC',
      [accountId],
    );
  }

  async findByDateRange(
    accountId: string,
    startDate: number,
    endDate: number,
  ): Promise<Transaction[]> {
    return this.rawQuery(
      'SELECT * FROM transactions WHERE account_id = ? AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC',
      [accountId, startDate, endDate],
    );
  }

  async findByCategory(categoryId: string): Promise<Transaction[]> {
    return this.rawQuery(
      'SELECT * FROM transactions WHERE category_id = ? ORDER BY date DESC',
      [categoryId],
    );
  }

  async findById(id: string): Promise<Transaction | null> {
    const tx = await super.findById(id);
    if (tx) {
      tx.images = await this.getImages(id);
    }
    return tx;
  }

  async delete(id: string): Promise<void> {
    await deleteTransactionImage(id);
    await executeSql('DELETE FROM transactions WHERE id = ?', [id]);
  }

  async getMonthlyStats(
    accountId: string,
    year: number,
    month: number,
  ): Promise<{
    totalIncome: number;
    totalExpense: number;
    netChange: number;
    transactionCount: number;
  }> {
    const startDate = new Date(year, month - 1, 1).getTime();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const rows = await this.queryScalar<{
      total_income: number;
      total_expense: number;
      transaction_count: number;
    }>(
      `SELECT
        SUM(CASE WHEN type = 'income' THEN COALESCE(converted_amount, amount) ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN COALESCE(converted_amount, amount) ELSE 0 END) as total_expense,
        COUNT(*) as transaction_count
       FROM transactions WHERE account_id = ? AND date >= ? AND date <= ?`,
      [accountId, startDate, endDate],
    );

    const row = rows[0] || { total_income: 0, total_expense: 0, transaction_count: 0 };
    const totalIncome = row.total_income || 0;
    const totalExpense = row.total_expense || 0;
    return {
      totalIncome,
      totalExpense,
      netChange: totalIncome - totalExpense,
      transactionCount: row.transaction_count || 0,
    };
  }

  async getCategoryBreakdown(
    accountId: string,
    startDate: number,
    endDate: number,
    type: 'income' | 'expense',
  ): Promise<Array<{ categoryId: string; totalAmount: number; transactionCount: number }>> {
    return this.queryScalar(
      `SELECT
        category_id as categoryId,
        SUM(COALESCE(converted_amount, amount)) as totalAmount,
        COUNT(*) as transactionCount
       FROM transactions
       WHERE account_id = ? AND type = ? AND date >= ? AND date <= ?
       GROUP BY category_id ORDER BY totalAmount DESC`,
      [accountId, type, startDate, endDate],
    );
  }

  async getImages(transactionId: string): Promise<string[]> {
    try {
      const rows = await executeSql<{ image_path: string }>(
        'SELECT image_path FROM transaction_images WHERE transaction_id = ? ORDER BY sort_order ASC',
        [transactionId],
      );
      return rows.map((r) => r.image_path);
    } catch {
      return [];
    }
  }

  async addImage(transactionId: string, imagePath: string, sortOrder: number): Promise<void> {
    await executeSql(
      'INSERT INTO transaction_images (id, transaction_id, image_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), transactionId, imagePath, sortOrder, Date.now()],
    );
  }

  async deleteImages(transactionId: string): Promise<void> {
    await executeSql('DELETE FROM transaction_images WHERE transaction_id = ?', [transactionId]);
  }
}
