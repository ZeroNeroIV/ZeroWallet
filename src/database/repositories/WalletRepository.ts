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
      createdAt: row.created_at as number,
      updatedAt: (row.updated_at as number) ?? 0,
    };
  }

  async findByAccount(accountId: string): Promise<Wallet[]> {
    return this.rawQuery(
      'SELECT * FROM wallets WHERE account_id = ? ORDER BY is_default DESC, created_at ASC',
      [accountId],
    );
  }

  async delete(id: string): Promise<void> {
    const wallet = await this.findById(id);
    if (wallet?.isDefault) {
      throw new Error('Cannot delete default wallet');
    }
    // Refuse while money history or scheduled items reference the wallet
    const used = await this.countTransactions(id);
    if (used > 0) {
      throw new Error('Cannot delete a wallet that has transactions. Move them first.');
    }
    const subRefs = await executeSql<{ count: number }>(
      'SELECT COUNT(*) as count FROM subscriptions WHERE vault_type = ?',
      [id]
    );
    const recRefs = await executeSql<{ count: number }>(
      'SELECT COUNT(*) as count FROM recurring_expenses WHERE vault_type = ?',
      [id]
    );
    if ((subRefs[0]?.count ?? 0) + (recRefs[0]?.count ?? 0) > 0) {
      throw new Error('Cannot delete a wallet used by subscriptions or recurring expenses. Reassign them first.');
    }
    await executeSql('DELETE FROM wallets WHERE id = ?', [id]);
  }

  async countTransactions(walletId: string): Promise<number> {
    const rows = await executeSql<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE vault_type = ?',
      [walletId]
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * Purpose: Seed the 7 built-in wallets for an account (idempotent).
   * Built-ins keep stable ids equal to their vault keys so every existing
   * transaction keeps working untouched.
   */
  async ensureDefaultWallets(accountId: string): Promise<Wallet[]> {
    const existing = await this.findByAccount(accountId);
    const existingIds = new Set(existing.map((w) => w.id));
    for (const key of VAULT_TYPE_VALUES) {
      if (existingIds.has(key)) continue;
      const meta = WALLET_META[key as keyof typeof WALLET_META];
      if (!meta) continue;
      const now = Date.now();
      await executeSql(
        `INSERT OR IGNORE INTO wallets (id, account_id, name, icon, color, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [key, accountId, meta.name, meta.icon, meta.color, 1, now, now]
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
