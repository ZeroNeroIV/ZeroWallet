// Account Repository — extends BaseRepository
import { executeSql } from '../index';
import { BaseRepository } from '../BaseRepository';
import type { Account } from '../../types/models';
import type { FieldMapping } from '../types';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'userId', column: 'user_id' },
  { field: 'name', column: 'name' },
  { field: 'currency', column: 'currency' },
  { field: 'icon', column: 'icon' },
  { field: 'color', column: 'color' },
  { field: 'isDefault', column: 'is_default' },
];

export class AccountRepository extends BaseRepository<Account> {
  protected tableName = 'accounts';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): Account {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      currency: row.currency as string,
      icon: row.icon as string,
      color: row.color as string,
      isDefault: (row.is_default as number) === 1,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async create(data: {
    userId: string;
    name: string;
    currency: string;
    icon: string;
    color: string;
    isDefault: boolean;
  }): Promise<Account> {
    if (data.isDefault) {
      await executeSql(
        'UPDATE accounts SET is_default = 0 WHERE user_id = ?',
        [data.userId],
      );
    }

    const id = await this.insert(data as unknown as Record<string, unknown>);
    return (await this.findById(id)) as Account;
  }

  async findByUser(userId: string): Promise<Account[]> {
    return this.rawQuery(
      'SELECT * FROM accounts WHERE user_id = ? ORDER BY is_default DESC, created_at ASC',
      [userId],
    );
  }

  async findDefaultByUser(userId: string): Promise<Account | null> {
    const rows = await this.rawQuery(
      'SELECT * FROM accounts WHERE user_id = ? AND is_default = 1',
      [userId],
    );
    if (rows.length > 0) return rows[0];
    const all = await this.findByUser(userId);
    return all[0] || null;
  }

  async update(id: string, updates: Partial<Account>): Promise<void> {
    if (updates.isDefault) {
      const account = await this.findById(id);
      if (account) {
        await executeSql(
          'UPDATE accounts SET is_default = 0 WHERE user_id = ? AND id != ?',
          [account.userId, id],
        );
      }
    }
    await super.update(id, updates);
  }
}
