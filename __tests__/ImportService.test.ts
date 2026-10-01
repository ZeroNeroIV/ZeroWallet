import { importPayload } from '../src/services/dataTransfer/importService';
import { WalletRepository } from '../src/database/repositories/WalletRepository';
import * as dbModule from '../src/database';

jest.mock('../src/database/repositories/TransactionRepository', () => ({
  TransactionRepository: jest.fn().mockImplementation(() => ({
    findByAccount: jest.fn().mockResolvedValue([]),
  })),
}));

describe('ImportService & Wallet Backward Compatibility', () => {
  let executedSqlList: Array<{ sql: string; params: any[] }> = [];
  let inMemoryWallets: Array<any> = [];
  let inMemoryAccounts: Array<any> = [];

  beforeEach(() => {
    executedSqlList = [];
    inMemoryWallets = [];
    inMemoryAccounts = [];

    jest.spyOn(dbModule, 'executeSql').mockImplementation(async (sql: string, params: any[] = []) => {
      executedSqlList.push({ sql, params });

      // Handle queries for accounts
      if (sql.includes('SELECT id FROM accounts WHERE id = ?')) {
        const id = params[0];
        const acc = inMemoryAccounts.find((a) => a.id === id);
        return acc ? [{ id }] : ([] as any);
      }
      if (sql.includes('UPDATE accounts SET')) {
        const [name, currency, icon, color, updated_at, id] = params;
        const idx = inMemoryAccounts.findIndex((a) => a.id === id);
        if (idx >= 0) {
          inMemoryAccounts[idx] = { ...inMemoryAccounts[idx], name, currency, icon, color, updated_at };
        }
        return [] as any;
      }
      if (sql.includes('INSERT INTO accounts')) {
        const [id, user_id, name, currency, icon, color, is_default, created_at, updated_at] = params;
        inMemoryAccounts.push({ id, user_id, name, currency, icon, color, is_default, created_at, updated_at });
        return [] as any;
      }

      // Handle queries for wallets
      if (sql.includes('SELECT * FROM wallets WHERE account_id = ?')) {
        const accountId = params[0];
        const rows = inMemoryWallets.filter((w) => w.account_id === accountId);
        return rows as any;
      }

      // Handle INSERT into wallets
      if (sql.includes('INSERT') && sql.includes('wallets')) {
        const [id, account_id, name, icon, color, is_default, created_at, updated_at] = params;
        const existingIdx = inMemoryWallets.findIndex(
          (w) => w.id === id && w.account_id === account_id
        );
        if (existingIdx >= 0) {
          if (sql.includes('ON CONFLICT')) {
            inMemoryWallets[existingIdx] = {
              ...inMemoryWallets[existingIdx],
              name,
              icon,
              color,
              updated_at,
            };
          }
        } else {
          inMemoryWallets.push({
            id,
            account_id,
            name,
            icon,
            color,
            is_default: is_default ?? 0,
            created_at: created_at ?? Date.now(),
            updated_at: updated_at ?? Date.now(),
          });
        }
        return [] as any;
      }

      // Handle existingIds query
      if (sql.includes('SELECT id FROM')) {
        return [] as any;
      }

      // Handle category checks
      if (sql.includes('SELECT id, name, type FROM categories')) {
        return [{ id: 'cat-general', name: 'General', type: 'expense' }] as any;
      }
      if (sql.includes('SELECT id FROM categories')) {
        return [{ id: params[0] || 'cat-general' }] as any;
      }

      return [] as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('WalletRepository compound primary key & multi-account support', () => {
    it('seeds default wallets for multiple accounts independently without collision', async () => {
      const repo = new WalletRepository();

      const acc1Wallets = await repo.ensureDefaultWallets('acc-1');
      expect(acc1Wallets).toHaveLength(7);
      expect(acc1Wallets.map((w) => w.id)).toContain('main');
      expect(acc1Wallets.map((w) => w.id)).toContain('savings');
      expect(acc1Wallets.map((w) => w.id)).toContain('held');

      const acc2Wallets = await repo.ensureDefaultWallets('acc-2');
      expect(acc2Wallets).toHaveLength(7);
      expect(acc2Wallets.map((w) => w.id)).toContain('main');
      expect(acc2Wallets.map((w) => w.id)).toContain('savings');
      expect(acc2Wallets.map((w) => w.id)).toContain('held');

      // Total in memory wallets should be 14 (7 per account)
      expect(inMemoryWallets).toHaveLength(14);
    });

    it('creates custom wallets scoped to an account', async () => {
      const repo = new WalletRepository();

      await repo.create({
        id: 'crypto',
        accountId: 'acc-1',
        name: 'Crypto Vault',
        icon: 'bitcoin',
        color: '#F7931A',
        isDefault: false,
      });

      const acc1Wallets = await repo.findByAccount('acc-1');
      expect(acc1Wallets.some((w) => w.id === 'crypto' && w.name === 'Crypto Vault')).toBe(true);

      const acc2Wallets = await repo.findByAccount('acc-2');
      expect(acc2Wallets.some((w) => w.id === 'crypto')).toBe(false);
    });
  });

  describe('importPayload backward compatibility', () => {
    it('correctly imports legacy v1.0 exports without wallets array and preserves snake_case vault_type', async () => {
      const legacyBackup = {
        version: '1.0',
        data: {
          categories: [
            {
              id: 'cat-food',
              user_id: 'user-1',
              name: 'Food & Dining',
              type: 'expense',
              icon: 'silverware',
              color: '#FF9800',
              is_default: 1,
            },
          ],
          transactions: [
            {
              id: 'tx-1',
              account_id: 'acc-1',
              type: 'expense',
              amount: 50,
              category_id: 'cat-food',
              description: 'Groceries',
              date: 1680000000000,
              vault_type: 'savings', // snake_case legacy!
              is_recurring: 0,
              converted_amount: 50,
            },
            {
              id: 'tx-2',
              account_id: 'acc-1',
              type: 'expense',
              amount: 120,
              category_id: 'cat-food',
              description: 'Internet Bill',
              date: 1680001000000,
              vault_type: 'held', // snake_case legacy!
              is_recurring: 1,
              recurring_expense_id: 'rec-1',
            },
            {
              id: 'tx-3',
              account_id: 'acc-1',
              type: 'income',
              amount: 500,
              category_id: 'cat-food',
              description: 'Bitcoin reward',
              date: 1680002000000,
              vault_type: 'crypto', // custom wallet in legacy transaction!
              is_recurring: 0,
            },
          ],
          subscriptions: [
            {
              id: 'sub-1',
              name: 'Netflix',
              amount: 15,
              category_id: 'cat-food',
              billing_day: 5,
              is_active: 1,
              vault_type: 'card',
            },
          ],
          recurringExpenses: [
            {
              id: 'rec-1',
              name: 'Rent',
              amount: 800,
              category_id: 'cat-food',
              frequency: 'monthly',
              interval: 1,
              vault_type: 'salary',
              is_active: 1,
              auto_deduct: 1,
            },
          ],
        },
      };

      const counts = await importPayload(legacyBackup, 'acc-1', 'user-1');

      // 7 built-in + 1 custom 'crypto' = 8 wallets total
      expect(counts.wallets).toBe(8);
      expect(counts.transactions).toBe(3);
      expect(counts.subscriptions).toBe(1);
      expect(counts.recurringExpenses).toBe(1);

      // Verify that tx-1 was inserted with vault_type 'savings' and NOT 'main'
      const tx1Insert = executedSqlList.find(
        (e) => e.sql.includes('INSERT INTO transactions') && e.params[0] === 'tx-1'
      );
      expect(tx1Insert).toBeDefined();
      // Parameter index 7 is vault_type
      expect(tx1Insert?.params[7]).toBe('savings');

      // Verify tx-2 was inserted with vault_type 'held'
      const tx2Insert = executedSqlList.find(
        (e) => e.sql.includes('INSERT INTO transactions') && e.params[0] === 'tx-2'
      );
      expect(tx2Insert?.params[7]).toBe('held');

      // Verify tx-3 was inserted with vault_type 'crypto'
      const tx3Insert = executedSqlList.find(
        (e) => e.sql.includes('INSERT INTO transactions') && e.params[0] === 'tx-3'
      );
      expect(tx3Insert?.params[7]).toBe('crypto');

      // Verify custom wallet 'crypto' was automatically seeded into wallets table
      expect(inMemoryWallets.some((w) => w.id === 'crypto' && w.name === 'Crypto')).toBe(true);
    });

    it('handles legacy exports where arrays are directly top-level without .data envelope', async () => {
      const topLevelBackup = {
        version: '1.0',
        categories: [],
        transactions: [
          {
            id: 'tx-simple',
            type: 'income',
            amount: 100,
            vault_type: 'physical',
          },
        ],
      };

      const counts = await importPayload(topLevelBackup, 'acc-2', 'user-2');
      expect(counts.transactions).toBe(1);
      expect(counts.wallets).toBeGreaterThanOrEqual(7);

      const txInsert = executedSqlList.find(
        (e) => e.sql.includes('INSERT INTO transactions') && e.params[0] === 'tx-simple'
      );
      expect(txInsert?.params[7]).toBe('physical');
    });

    it('correctly imports v1.1 backup with data.account (JOD, My Wallet) and is resilient with ON CONFLICT', async () => {
      const v11Backup = {
        version: '1.1',
        exportedAt: '2026-10-01T12:28:14.837Z',
        data: {
          account: {
            id: 'b43becda-f4ba-48af-9843-f56c61250443',
            userId: 'user-old',
            name: 'My Wallet',
            currency: 'JOD',
            icon: 'wallet',
            color: '#4ECDC4',
            isDefault: true,
            createdAt: 1790438995751,
            updatedAt: 1790438995751,
          },
          categories: [
            {
              id: 'cat-bills',
              name: 'Bills & Utilities',
              type: 'expense',
              icon: 'receipt',
              color: '#FF8B94',
            },
            {
              id: 'cat-food',
              name: 'Food & Dining',
              type: 'expense',
              icon: 'food',
              color: '#FF6B6B',
            },
          ],
          transactions: [
            {
              id: 'tx-sub',
              accountId: 'b43becda-f4ba-48af-9843-f56c61250443',
              type: 'expense',
              amount: 3.55,
              categoryId: 'cat-bills',
              description: 'Google AI Pro Subscription',
              date: 1790851467163,
              vaultType: 'card',
              currency: 'JOD',
              convertedAmount: null,
            },
            {
              id: 'tx-snacks',
              accountId: 'b43becda-f4ba-48af-9843-f56c61250443',
              type: 'expense',
              amount: 2.0,
              categoryId: 'cat-food',
              description: 'Snacks',
              date: 1790748420000,
              vaultType: 'physical',
              currency: 'JOD',
              convertedAmount: null,
            },
          ],
          // Notice: no wallets array in v1.1
        },
      };

      const counts = await importPayload(v11Backup, 'acc-current', 'user-current');

      expect(counts.account).toBe(1);
      expect(counts.wallets).toBeGreaterThanOrEqual(7);
      expect(counts.transactions).toBe(2);
      expect(counts.categories).toBe(2);

      // Verify the account in DB was updated with name 'My Wallet' and currency 'JOD'
      const acc = inMemoryAccounts.find((a) => a.id === 'acc-current');
      expect(acc).toBeDefined();
      expect(acc?.name).toBe('My Wallet');
      expect(acc?.currency).toBe('JOD');

      // Verify transactions inserted have ON CONFLICT clause
      const txInserts = executedSqlList.filter((e) => e.sql.includes('INSERT INTO transactions'));
      expect(txInserts.length).toBeGreaterThanOrEqual(2);
      expect(txInserts[0].sql).toContain('ON CONFLICT(id) DO UPDATE SET');

      // Re-running the import must be completely idempotent and not throw
      const reCounts = await importPayload(v11Backup, 'acc-current', 'user-current');
      expect(reCounts.account).toBe(1);
      expect(reCounts.transactions).toBe(2);
    });
  });
});
