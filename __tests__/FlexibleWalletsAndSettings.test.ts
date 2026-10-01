import { WalletRepository } from '../src/database/repositories/WalletRepository';
import { importPayload } from '../src/services/dataTransfer/importService';
import { useSettingsStore } from '../src/store/settingsStore';
import * as dbModule from '../src/database';

jest.mock('../src/database/repositories/TransactionRepository', () => ({
  TransactionRepository: jest.fn().mockImplementation(() => ({
    findByAccount: jest.fn().mockResolvedValue([]),
  })),
}));

describe('Flexible Wallets & Settings Backup Restoration', () => {
  let executedSqlList: Array<{ sql: string; params: any[] }> = [];
  let inMemoryWallets: Array<any> = [];
  let inMemoryTransactions: Array<any> = [];
  let inMemorySubscriptions: Array<any> = [];
  let inMemoryRecurring: Array<any> = [];

  beforeEach(() => {
    executedSqlList = [];
    inMemoryWallets = [];
    inMemoryTransactions = [];
    inMemorySubscriptions = [];
    inMemoryRecurring = [];

    jest.spyOn(dbModule, 'executeSql').mockImplementation(async (sql: string, params: any[] = []) => {
      executedSqlList.push({ sql, params });

      // Wallets queries
      if (sql.includes('SELECT * FROM wallets WHERE account_id = ?')) {
        const accountId = params[0];
        return inMemoryWallets.filter((w) => w.account_id === accountId) as any;
      }
      if (sql.includes('SELECT * FROM wallets WHERE id = ?')) {
        const id = params[0];
        return inMemoryWallets.filter((w) => w.id === id) as any;
      }
      if (sql.includes('INSERT') && sql.includes('wallets')) {
        const [id, account_id, name, icon, color, is_default, created_at, updated_at] = params;
        inMemoryWallets.push({ id, account_id, name, icon, color, is_default, created_at, updated_at });
        return [] as any;
      }
      if (sql.includes('DELETE FROM wallets WHERE id = ? AND account_id = ?')) {
        const [id, account_id] = params;
        inMemoryWallets = inMemoryWallets.filter((w) => !(w.id === id && w.account_id === account_id));
        return [] as any;
      }
      if (sql.includes('DELETE FROM wallets WHERE id = ?')) {
        const [id] = params;
        inMemoryWallets = inMemoryWallets.filter((w) => w.id !== id);
        return [] as any;
      }

      // Usage count queries
      if (sql.includes('SELECT COUNT(*) as count FROM transactions WHERE vault_type = ?')) {
        const [wId] = params;
        const count = inMemoryTransactions.filter((t) => t.vault_type === wId).length;
        return [{ count }] as any;
      }
      if (sql.includes('SELECT COUNT(*) as count FROM subscriptions WHERE vault_type = ?')) {
        const [wId] = params;
        const count = inMemorySubscriptions.filter((s) => s.vault_type === wId).length;
        return [{ count }] as any;
      }
      if (sql.includes('SELECT COUNT(*) as count FROM recurring_expenses WHERE vault_type = ?')) {
        const [wId] = params;
        const count = inMemoryRecurring.filter((r) => r.vault_type === wId).length;
        return [{ count }] as any;
      }

      // Reassignment updates
      if (sql.includes('UPDATE transactions SET vault_type = ? WHERE vault_type = ?')) {
        const [dest, src] = params;
        inMemoryTransactions.forEach((t) => {
          if (t.vault_type === src) t.vault_type = dest;
        });
        return [] as any;
      }
      if (sql.includes('UPDATE subscriptions SET vault_type = ? WHERE vault_type = ?')) {
        const [dest, src] = params;
        inMemorySubscriptions.forEach((s) => {
          if (s.vault_type === src) s.vault_type = dest;
        });
        return [] as any;
      }
      if (sql.includes('UPDATE recurring_expenses SET vault_type = ? WHERE vault_type = ?')) {
        const [dest, src] = params;
        inMemoryRecurring.forEach((r) => {
          if (r.vault_type === src) r.vault_type = dest;
        });
        return [] as any;
      }

      return [] as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('starter wallet can be deleted when unused and account has other wallets', async () => {
    const repo = new WalletRepository();
    inMemoryWallets = [
      { id: 'main', account_id: 'acc-1', name: 'Main', is_default: 1 },
      { id: 'savings', account_id: 'acc-1', name: 'Savings', is_default: 1 },
    ];

    await repo.delete('savings', 'acc-1');

    expect(inMemoryWallets).toHaveLength(1);
    expect(inMemoryWallets[0].id).toBe('main');
  });

  test('cannot delete only remaining wallet', async () => {
    const repo = new WalletRepository();
    inMemoryWallets = [{ id: 'main', account_id: 'acc-1', name: 'Main', is_default: 1 }];

    await expect(repo.delete('main', 'acc-1')).rejects.toThrow(
      'Cannot delete your only remaining wallet'
    );
  });

  test('cannot delete wallet with transactions without providing destination wallet', async () => {
    const repo = new WalletRepository();
    inMemoryWallets = [
      { id: 'main', account_id: 'acc-1', name: 'Main', is_default: 1 },
      { id: 'card', account_id: 'acc-1', name: 'Card', is_default: 1 },
    ];
    inMemoryTransactions = [
      { id: 'tx-1', account_id: 'acc-1', vault_type: 'card', amount: 50 },
    ];

    await expect(repo.delete('card', 'acc-1')).rejects.toThrow(
      'without reassigning them'
    );
  });

  test('deleting wallet with destination wallet atomically reassigns transactions and subscriptions', async () => {
    const repo = new WalletRepository();
    inMemoryWallets = [
      { id: 'main', account_id: 'acc-1', name: 'Main', is_default: 1 },
      { id: 'card', account_id: 'acc-1', name: 'Card', is_default: 1 },
    ];
    inMemoryTransactions = [
      { id: 'tx-1', account_id: 'acc-1', vault_type: 'card', amount: 50 },
    ];
    inMemorySubscriptions = [
      { id: 'sub-1', account_id: 'acc-1', vault_type: 'card', amount: 10 },
    ];

    await repo.delete('card', 'acc-1', 'main');

    // Card wallet is deleted
    expect(inMemoryWallets).toHaveLength(1);
    expect(inMemoryWallets[0].id).toBe('main');

    // Transactions and subscriptions were reassigned to 'main'
    expect(inMemoryTransactions[0].vault_type).toBe('main');
    expect(inMemorySubscriptions[0].vault_type).toBe('main');
  });

  test('ensureDefaultWallets does not resurrect deleted starter wallets if wallets already exist', async () => {
    const repo = new WalletRepository();
    // User had deleted 5 wallets and only kept 'main' and 'savings'
    inMemoryWallets = [
      { id: 'main', account_id: 'acc-1', name: 'Main', is_default: 1 },
      { id: 'savings', account_id: 'acc-1', name: 'Savings', is_default: 1 },
    ];

    const result = await repo.ensureDefaultWallets('acc-1');

    // Should return existing and NOT re-seed the other 5
    expect(result).toHaveLength(2);
    expect(inMemoryWallets).toHaveLength(2);
  });

  test('importPayload hydrates salary, notifications, app, and security settings', async () => {
    const backupData = {
      version: '1.2',
      data: {
        account: { id: 'acc-99', name: 'Test Account', currency: 'JOD' },
        wallets: [{ id: 'main', name: 'Main' }],
        salarySettings: {
          isEnabled: true,
          amount: 1500,
          payDay: 25,
        },
        notificationSettings: {
          dailyNudgeEnabled: true,
          nudgeTime: '21:30',
        },
        appSettings: {
          theme: 'dark',
          hapticFeedback: false,
        },
        securitySettings: {
          isEnabled: true,
          authType: 'pin',
        },
      },
    };

    await importPayload(backupData, 'acc-99', 'user-1', null);

    const store = useSettingsStore.getState();
    expect(store.salarySettings.isEnabled).toBe(true);
    expect(store.salarySettings.amount).toBe(1500);
    expect(store.salarySettings.payDay).toBe(25);
    expect(store.notificationSettings.nudgeTime).toBe('21:30');
    expect(store.appSettings.theme).toBe('dark');
    expect(store.appSettings.hapticFeedback).toBe(false);
    expect(store.securitySettings.isEnabled).toBe(true);
    expect(store.securitySettings.authType).toBe('pin');
  });
});
