// Transaction Repository — extends BaseRepository
import { v4 as uuidv4 } from 'uuid';
import { executeSql } from '../index';
import { BaseRepository } from '../BaseRepository';
import type { Transaction, TransactionInput } from '../../types/models';
import type { FieldMapping } from '../types';
import { deleteTransactionImage } from '../../utils/imageStorage';
import { calculateVaultBalances } from '../../utils/balanceCalculator';
import { useAccountStore } from '../../store/accountStore';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'accountId', column: 'account_id' },
  { field: 'type', column: 'type' },
  { field: 'amount', column: 'amount' },
  { field: 'categoryId', column: 'category_id' },
  { field: 'description', column: 'description' },
  { field: 'date', column: 'date' },
  { field: 'vaultType', column: 'vault_type' },
  { field: 'walletId', column: 'wallet_id' },
  { field: 'destinationWalletId', column: 'destination_wallet_id' },
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
    const effectiveWallet = ((row.wallet_id as string) || (row.vault_type as string) || 'main') as Transaction['vaultType'];
    return {
      id: row.id as string,
      accountId: row.account_id as string,
      type: row.type as Transaction['type'],
      amount: row.amount as number,
      categoryId: row.category_id as string,
      description: row.description as string,
      date: row.date as number,
      vaultType: effectiveWallet,
      walletId: effectiveWallet,
      destinationWalletId: (row.destination_wallet_id as string) || undefined,
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

  private async notifyAccountChanged(accountId?: string): Promise<void> {
    try {
      if (accountId) {
        const allTxs = await this.findByAccount(accountId);
        const recalculated = calculateVaultBalances(allTxs);
        useAccountStore.getState().updateBalance(accountId, recalculated);
      }
    } catch {
      // Non-fatal in isolated unit tests
    }
    useAccountStore.getState().bumpDataRevision();
  }

  private async findTransferCounterpartId(tx: Transaction): Promise<string | null> {
    if (!tx.destinationWalletId || tx.type === 'transfer') return null;
    const sourceWallet = tx.walletId || tx.vaultType;
    const destWallet = tx.destinationWalletId;
    const oppositeType = tx.type === 'expense' ? 'income' : 'expense';
    try {
      const rows = await executeSql<{ id: string }>(
        `SELECT id FROM transactions
         WHERE account_id = ?
           AND id != ?
           AND type = ?
           AND COALESCE(NULLIF(wallet_id, ''), vault_type, 'main') = ?
           AND destination_wallet_id = ?
           AND ABS(date - ?) <= 10000
         ORDER BY ABS(date - ?) ASC, ABS(amount - ?) ASC
         LIMIT 1`,
        [
          tx.accountId,
          tx.id,
          oppositeType,
          destWallet,
          sourceWallet,
          tx.date,
          tx.date,
          tx.amount,
        ],
      );
      return rows[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  private async adjustLinkedGoalOrDebt(tx: Transaction, deltaAmount: number): Promise<void> {
    if (!deltaAmount || !tx.description) return;
    try {
      const goalMatch =
        tx.description.match(/^Funded Goal:\s*(.+)$/) ||
        tx.description.match(/\(Goal:\s*(.+)\)$/);
      if (goalMatch?.[1]) {
        const goalName = goalMatch[1].trim();
        const goals = await executeSql<{
          id: string;
          current_amount: number;
          target_amount: number | null;
        }>(
          'SELECT id, current_amount, target_amount FROM goals WHERE account_id = ? AND name = ? LIMIT 1',
          [tx.accountId, goalName],
        );
        if (goals[0]) {
          const g = goals[0];
          const newCurrent = Math.max(
            0,
            Math.round(((Number(g.current_amount) || 0) + deltaAmount) * 1000) / 1000,
          );
          const isCompleted =
            g.target_amount && g.target_amount > 0 && newCurrent >= g.target_amount ? 1 : 0;
          await executeSql(
            'UPDATE goals SET current_amount = ?, is_completed = ?, completed_at = ?, updated_at = ? WHERE id = ?',
            [newCurrent, isCompleted, isCompleted ? Date.now() : null, Date.now(), g.id],
          );
        }
      }

      const debtMatch =
        tx.description.match(/^Debt (?:Repayment|Settlement):\s*(.+?)(?:\s+—\s+.*)?$/) ||
        tx.description.match(/^(?:Repaid loan from|Received debt repayment from)\s+(.+)$/);
      if (debtMatch?.[1]) {
        const personName = debtMatch[1].trim();
        const debts = await executeSql<{
          id: string;
          amount: number;
          amount_paid: number;
        }>(
          'SELECT id, amount, amount_paid FROM debts WHERE account_id = ? AND person_name = ? LIMIT 1',
          [tx.accountId, personName],
        );
        if (debts[0]) {
          const d = debts[0];
          const newPaid = Math.max(
            0,
            Math.round(((Number(d.amount_paid) || 0) + deltaAmount) * 1000) / 1000,
          );
          const newStatus =
            newPaid >= d.amount ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
          await executeSql(
            'UPDATE debts SET amount_paid = ?, status = ?, updated_at = ? WHERE id = ?',
            [newPaid, newStatus, Date.now(), d.id],
          );
        }
      }
    } catch {
      // Non-fatal if goals/debts tables are mocked
    }
  }

  override async create(data: TransactionInput): Promise<Transaction> {
    const effectiveWallet = (data.walletId || data.vaultType || 'main') as Transaction['vaultType'];
    const convertedAmount = data.convertedAmount ?? data.amount;
    const created = await super.create({
      ...data,
      vaultType: effectiveWallet,
      walletId: effectiveWallet,
      convertedAmount,
    });
    await this.notifyAccountChanged(data.accountId);
    return created;
  }

  override async update(id: string, updates: Partial<Transaction>): Promise<void> {
    const existing = await this.findById(id);
    const normalized: Record<string, unknown> = { ...updates };

    if (updates.walletId !== undefined && updates.vaultType === undefined) {
      normalized.vaultType = updates.walletId;
    } else if (updates.vaultType !== undefined && updates.walletId === undefined) {
      normalized.walletId = updates.vaultType;
    }

    if (updates.amount !== undefined && updates.convertedAmount === undefined) {
      const rate =
        updates.exchangeRate !== undefined
          ? updates.exchangeRate
          : existing?.exchangeRate;
      normalized.convertedAmount =
        rate && rate > 0 && rate !== 1 ? updates.amount * rate : updates.amount;
    }

    await super.update(id, normalized as Partial<Transaction>);

    if (existing) {
      // Keep counterpart transfer leg in sync if a transfer transaction is edited
      if (existing.destinationWalletId) {
        const counterpartId = await this.findTransferCounterpartId(existing);
        if (counterpartId) {
          const pairUpdates: Record<string, unknown> = {};
          if (normalized.amount !== undefined) pairUpdates.amount = normalized.amount;
          if (normalized.convertedAmount !== undefined) {
            pairUpdates.convertedAmount = normalized.convertedAmount;
          }
          if (normalized.date !== undefined) pairUpdates.date = normalized.date;
          if (Object.keys(pairUpdates).length > 0) {
            await super.update(counterpartId, pairUpdates as Partial<Transaction>);
          }
        }
      }

      // Keep linked goal/debt in sync if amount changed
      const oldEffective = existing.convertedAmount ?? existing.amount;
      const newEffective =
        (normalized.convertedAmount as number | undefined) ??
        (normalized.amount as number | undefined) ??
        oldEffective;
      if (newEffective !== oldEffective) {
        await this.adjustLinkedGoalOrDebt(existing, newEffective - oldEffective);
      }

      await this.notifyAccountChanged(existing.accountId);
    } else {
      useAccountStore.getState().bumpDataRevision();
    }
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

  async findByWallet(walletId: string, accountId: string, limit?: number): Promise<Transaction[]> {
    if (limit) {
      return this.rawQuery(
        `SELECT * FROM transactions
         WHERE account_id = ?
           AND (
             COALESCE(NULLIF(wallet_id, ''), vault_type, 'main') = ?
             OR (type = 'transfer' AND destination_wallet_id = ?)
           )
         ORDER BY date DESC, created_at DESC LIMIT ?`,
        [accountId, walletId, walletId, limit],
      );
    }
    return this.rawQuery(
      `SELECT * FROM transactions
       WHERE account_id = ?
         AND (
           COALESCE(NULLIF(wallet_id, ''), vault_type, 'main') = ?
           OR (type = 'transfer' AND destination_wallet_id = ?)
         )
       ORDER BY date DESC, created_at DESC`,
      [accountId, walletId, walletId],
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

  override async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    let counterpartId: string | null = null;
    if (existing?.destinationWalletId) {
      counterpartId = await this.findTransferCounterpartId(existing);
    }

    await this.deleteImages(id);
    await deleteTransactionImage(id);
    await executeSql('DELETE FROM transactions WHERE id = ?', [id]);

    if (counterpartId) {
      await this.deleteImages(counterpartId);
      await deleteTransactionImage(counterpartId);
      await executeSql('DELETE FROM transactions WHERE id = ?', [counterpartId]);
    }

    if (existing) {
      const effectiveAmt = existing.convertedAmount ?? existing.amount;
      await this.adjustLinkedGoalOrDebt(existing, -effectiveAmt);
      await this.notifyAccountChanged(existing.accountId);
    } else {
      useAccountStore.getState().bumpDataRevision();
    }
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
        SUM(CASE WHEN type = 'income' AND (destination_wallet_id IS NULL OR destination_wallet_id = '') THEN COALESCE(converted_amount, amount) ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' AND (destination_wallet_id IS NULL OR destination_wallet_id = '') THEN COALESCE(converted_amount, amount) ELSE 0 END) as total_expense,
        COUNT(CASE WHEN type IN ('income', 'expense') AND (destination_wallet_id IS NULL OR destination_wallet_id = '') THEN 1 END) as transaction_count
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
       WHERE account_id = ?
         AND type = ?
         AND (destination_wallet_id IS NULL OR destination_wallet_id = '')
         AND date >= ? AND date <= ?
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

  async existsBySubscriptionAndDate(subscriptionId: string, date: number): Promise<boolean> {
    const rows = await executeSql<{ count: number }>(
      "SELECT COUNT(*) as count FROM transactions WHERE subscription_id = ? AND date >= ? AND date < ?",
      [subscriptionId, date, date + 24 * 60 * 60 * 1000],
    );
    return (rows[0]?.count ?? 0) > 0;
  }

  async existsByRecurringExpenseAndDate(recurringExpenseId: string, date: number): Promise<boolean> {
    const rows = await executeSql<{ count: number }>(
      "SELECT COUNT(*) as count FROM transactions WHERE recurring_expense_id = ? AND date >= ? AND date < ?",
      [recurringExpenseId, date, date + 24 * 60 * 60 * 1000],
    );
    return (rows[0]?.count ?? 0) > 0;
  }
  async existsAutoSalaryForMonth(accountId: string, monthDate: Date): Promise<boolean> {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0).getTime();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const targetDesc = `Monthly Salary - ${monthName} (Auto)`;

    const rows = await executeSql<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE account_id = ? 
         AND type = 'income' 
         AND (
           description = ? 
           OR (description LIKE 'Monthly Salary - %' AND date >= ? AND date <= ?)
         )`,
      [accountId, targetDesc, startOfMonth, endOfMonth],
    );
    return (rows[0]?.count ?? 0) > 0;
  }

  async existsAutoSalaryByDate(accountId: string, date: number): Promise<boolean> {
    return this.existsAutoSalaryForMonth(accountId, new Date(date));
  }

}
