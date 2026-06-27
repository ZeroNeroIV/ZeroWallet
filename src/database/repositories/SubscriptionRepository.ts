// Subscription Repository — extends BaseRepository
import { BaseRepository } from '../BaseRepository';
import type { Subscription, SubscriptionInput } from '../../types/models';
import type { FieldMapping } from '../types';

const FIELD_MAPPINGS: FieldMapping[] = [
  { field: 'accountId', column: 'account_id' },
  { field: 'name', column: 'name' },
  { field: 'amount', column: 'amount' },
  { field: 'categoryId', column: 'category_id' },
  { field: 'billingDay', column: 'billing_day' },
  { field: 'isActive', column: 'is_active' },
  { field: 'vaultType', column: 'vault_type' },
  { field: 'lastProcessed', column: 'last_processed' },
  { field: 'nextProcessing', column: 'next_processing' },
];

export class SubscriptionRepository extends BaseRepository<Subscription, SubscriptionInput> {
  protected tableName = 'subscriptions';
  protected fieldMappings = FIELD_MAPPINGS;

  protected mapRow(row: Record<string, unknown>): Subscription {
    return {
      id: row.id as string,
      accountId: row.account_id as string,
      name: row.name as string,
      amount: row.amount as number,
      categoryId: row.category_id as string,
      billingDay: row.billing_day as number,
      isActive: (row.is_active as number) === 1,
      vaultType: row.vault_type as Subscription['vaultType'],
      lastProcessed: row.last_processed as number | null,
      nextProcessing: row.next_processing as number,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  private calculateNextProcessing(billingDay: number): number {
    const now = new Date();
    const currentDay = now.getDate();
    let targetMonth = now.getMonth();
    let targetYear = now.getFullYear();

    if (currentDay >= billingDay) {
      targetMonth += 1;
      if (targetMonth > 11) { targetMonth = 0; targetYear += 1; }
    }

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const effectiveDay = Math.min(billingDay, daysInMonth);
    return new Date(targetYear, targetMonth, effectiveDay, 0, 0, 0, 0).getTime();
  }

  async create(data: SubscriptionInput): Promise<Subscription> {
    const nextProcessing = this.calculateNextProcessing(data.billingDay);
    const id = await this.insert(data as unknown as Record<string, unknown>, {
      next_processing: nextProcessing,
      last_processed: null,
    });
    return (await this.findById(id)) as Subscription;
  }

  async findActiveByAccount(accountId: string): Promise<Subscription[]> {
    return this.rawQuery(
      'SELECT * FROM subscriptions WHERE account_id = ? AND is_active = 1 ORDER BY name ASC',
      [accountId],
    );
  }

  async findDueSubscriptions(): Promise<Subscription[]> {
    return this.rawQuery(
      'SELECT * FROM subscriptions WHERE is_active = 1 AND next_processing <= ?',
      [Date.now()],
    );
  }

  async markAsProcessed(id: string): Promise<void> {
    const sub = await this.findById(id);
    if (!sub) throw new Error('Subscription not found');
    const now = Date.now();
    await this.queryScalar(
      'UPDATE subscriptions SET last_processed = ?, next_processing = ?, updated_at = ? WHERE id = ?',
      [now, this.calculateNextProcessing(sub.billingDay), now, id],
    );
  }

  async findDue(): Promise<Subscription[]> {
    return this.rawQuery(
      'SELECT * FROM subscriptions WHERE is_active = 1 AND next_processing <= ? ORDER BY name ASC',
      [Date.now()],
    );
  }

  async findOverdue(): Promise<Subscription[]> {
    return this.rawQuery(
      'SELECT * FROM subscriptions WHERE is_active = 1 AND next_processing < ? ORDER BY next_processing ASC',
      [Date.now()],
    );
  }

  async findByAccount(accountId: string): Promise<Subscription[]> {
    return this.rawQuery(
      'SELECT * FROM subscriptions WHERE account_id = ? ORDER BY is_active DESC, name ASC',
      [accountId],
    );
  }
}
