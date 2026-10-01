// Wallet Repository — extends BaseRepository
import { executeSql } from '../index';
import { BaseRepository } from '../BaseRepository';
import type { Wallet } from '../../types/models';
import type { FieldMapping } from '../types';
import { WALLET_META } from '../../utils/wallets';
import { VAULT_TYPE_VALUES } from '../../domain/vault/VaultType';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'accountId', column: 'account_id' },
  { field: 'name', column: 'name' },
  { field: 'icon', column: 'icon' },
  { field: 'color', column: 'color' },
  { field: 'isDefault', column: 'is_default' },
  { field: 'sortOrder', column: 'sort_order' },
];

export class WalletRepository extends BaseRepository<Wallet> {
  protected tableName = 'wallets';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): Wallet {
    return {
      id: row.id as string,
      accountId: row.account_id as string,
      name: row.name as string,
      icon: row.icon as string,
      color: row.color as string,
      isDefault: (row.is_default as number) === 1,
      sortOrder: (row.sort_order as number) ?? 0,
      createdAt: row.created_at as number,
      updatedAt: (row.updated_at as number) ?? 0,
    };
  }

  async findByAccount(accountId: string): Promise<Wallet[]> {
    return this.rawQuery(
      'SELECT * FROM wallets WHERE account_id = ? ORDER BY sort_order ASC, created_at ASC',
      [accountId],
    );
  }

  async findByAccountAndId(accountId: string, id: string): Promise<Wallet | null> {
    const rows = await this.rawQuery(
      'SELECT * FROM wallets WHERE account_id = ? AND id = ? LIMIT 1',
      [accountId, id],
    );
    return rows[0] ?? null;
  }

  override async findById(id: string, accountId?: string): Promise<Wallet | null> {
    if (accountId) {
      return this.findByAccountAndId(accountId, id);
    }
    const rows = await this.rawQuery('SELECT * FROM wallets WHERE id = ? LIMIT 1', [id]);
    return rows[0] ?? null;
  }

  override async create(data: Partial<Wallet> & { id?: string }): Promise<Wallet> {
    const accountId = data.accountId;
    if (!accountId) {
      throw new Error('accountId is required to create a wallet');
    }
    const id = data.id || slugWalletId(data.name || 'wallet');
    const now = Date.now();
    const name = data.name || 'Wallet';
    const icon = data.icon || 'wallet';
    const color = data.color || '#007AFF';
    const isDefault = data.isDefault ? 1 : 0;
    const sortOrder = data.sortOrder ?? 0;
    const createdAt = data.createdAt || now;
    const updatedAt = data.updatedAt || now;

    await executeSql(
      `INSERT INTO wallets (id, account_id, name, icon, color, is_default, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id, account_id) DO UPDATE SET
         name = excluded.name,
         icon = excluded.icon,
         color = excluded.color,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
      [id, accountId, name, icon, color, isDefault, sortOrder, createdAt, updatedAt]
    );

    const created = await this.findByAccountAndId(accountId, id);
    return created!;
  }

  override async update(id: string, updates: Partial<Wallet>, accountId?: string): Promise<void> {
    const accId = accountId ?? updates.accountId;
    const flat = updates as Record<string, unknown>;
    const updateValues: Record<string, unknown> = {};

    for (const mapping of this.fieldMappings) {
      if (flat[mapping.field] !== undefined) {
        updateValues[mapping.column] = flat[mapping.field];
      }
    }

    if (Object.keys(updateValues).length === 0) return;
    updateValues.updated_at = Date.now();

    const qb = this.createQuery().update(updateValues).where('id', id);
    if (accId) {
      qb.where('account_id', accId);
    }
    await qb.execute();
  }

  override async delete(id: string, accountId?: string, reassignToWalletId?: string): Promise<void> {
    if (accountId) {
      const allWallets = await this.findByAccount(accountId);
      if (allWallets.length <= 1) {
        throw new Error('Cannot delete your only remaining wallet. An account must have at least one wallet.');
      }
    }

    if (reassignToWalletId) {
      if (reassignToWalletId === id) {
        throw new Error('Destination wallet must be different from the wallet being deleted.');
      }
      // Atomically reassign all historical references to destination wallet
      if (accountId) {
        await executeSql(
          'UPDATE transactions SET vault_type = ? WHERE vault_type = ? AND account_id = ?',
          [reassignToWalletId, id, accountId]
        );
        await executeSql(
          'UPDATE subscriptions SET vault_type = ? WHERE vault_type = ? AND account_id = ?',
          [reassignToWalletId, id, accountId]
        );
        await executeSql(
          'UPDATE recurring_expenses SET vault_type = ? WHERE vault_type = ? AND account_id = ?',
          [reassignToWalletId, id, accountId]
        );
      } else {
        await executeSql('UPDATE transactions SET vault_type = ? WHERE vault_type = ?', [reassignToWalletId, id]);
        await executeSql('UPDATE subscriptions SET vault_type = ? WHERE vault_type = ?', [reassignToWalletId, id]);
        await executeSql('UPDATE recurring_expenses SET vault_type = ? WHERE vault_type = ?', [reassignToWalletId, id]);
      }
    } else {
      const usage = await this.getWalletUsage(id, accountId);
      const totalUsage = usage.transactions + usage.subscriptions + usage.recurring;
      if (totalUsage > 0) {
        throw new Error('Cannot delete a wallet that has transactions or subscriptions without reassigning them.');
      }
    }

    if (accountId) {
      await executeSql('DELETE FROM wallets WHERE id = ? AND account_id = ?', [id, accountId]);
    } else {
      await executeSql('DELETE FROM wallets WHERE id = ?', [id]);
    }
  }

  async countTransactions(walletId: string, accountId?: string): Promise<number> {
    const sql = accountId
      ? 'SELECT COUNT(*) as count FROM transactions WHERE vault_type = ? AND account_id = ?'
      : 'SELECT COUNT(*) as count FROM transactions WHERE vault_type = ?';
    const params = accountId ? [walletId, accountId] : [walletId];
    const rows = await executeSql<{ count: number }>(sql, params);
    return rows[0]?.count ?? 0;
  }

  async countSubscriptions(walletId: string, accountId?: string): Promise<number> {
    const sql = accountId
      ? 'SELECT COUNT(*) as count FROM subscriptions WHERE vault_type = ? AND account_id = ?'
      : 'SELECT COUNT(*) as count FROM subscriptions WHERE vault_type = ?';
    const params = accountId ? [walletId, accountId] : [walletId];
    const rows = await executeSql<{ count: number }>(sql, params);
    return rows[0]?.count ?? 0;
  }

  async countRecurring(walletId: string, accountId?: string): Promise<number> {
    const sql = accountId
      ? 'SELECT COUNT(*) as count FROM recurring_expenses WHERE vault_type = ? AND account_id = ?'
      : 'SELECT COUNT(*) as count FROM recurring_expenses WHERE vault_type = ?';
    const params = accountId ? [walletId, accountId] : [walletId];
    const rows = await executeSql<{ count: number }>(sql, params);
    return rows[0]?.count ?? 0;
  }

  async getWalletUsage(walletId: string, accountId?: string): Promise<{ transactions: number; subscriptions: number; recurring: number }> {
    const [transactions, subscriptions, recurring] = await Promise.all([
      this.countTransactions(walletId, accountId),
      this.countSubscriptions(walletId, accountId),
      this.countRecurring(walletId, accountId),
    ]);
    return { transactions, subscriptions, recurring };
  }

  /**
   * Purpose: Atomically update the sort_order of all wallets in an account.
   */
  async reorderWallets(accountId: string, orderedIds: string[]): Promise<void> {
    await executeSql('BEGIN TRANSACTION;');
    try {
      const now = Date.now();
      for (let i = 0; i < orderedIds.length; i++) {
        await executeSql(
          'UPDATE wallets SET sort_order = ?, updated_at = ? WHERE id = ? AND account_id = ?;',
          [i, now, orderedIds[i], accountId]
        );
      }
      await executeSql('COMMIT;');
    } catch (err) {
      await executeSql('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Purpose: Seed initial starter wallets for an account on initial creation.
   * If the account already has wallets (even if the user deleted some starter wallets),
   * do not resurrect deleted wallets.
   */
  async ensureDefaultWallets(accountId: string): Promise<Wallet[]> {
    const existing = await this.findByAccount(accountId);
    if (existing.length > 0) {
      return existing;
    }
    const now = Date.now();
    let orderIndex = 0;
    for (const key of VAULT_TYPE_VALUES) {
      const meta = WALLET_META[key as keyof typeof WALLET_META];
      if (!meta) continue;
      await executeSql(
        `INSERT OR IGNORE INTO wallets (id, account_id, name, icon, color, is_default, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [key, accountId, meta.name, meta.icon, meta.color, orderIndex++, now, now]
      );
    }
    return this.findByAccount(accountId);
  }
}

/**
 * Purpose: Build a slug-based id for a user-created wallet.
 * Slugs keep ids (and therefore balance keys) readable and URL-safe.
 */
export function slugWalletId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'wallet';
  const suffix = Date.now().toString(36).slice(-4);
  return `w_${slug}-${suffix}`;
}
