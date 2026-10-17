import { TransactionRepository } from '../src/database/repositories/TransactionRepository';
import { WalletRepository } from '../src/database/repositories/WalletRepository';
import { calculateVaultBalances } from '../src/utils/balanceCalculator';
import { useAccountStore } from '../src/store/accountStore';
import { executeSql } from '../src/database/index';
import type { Transaction } from '../src/types/models';

jest.mock('../src/database/index', () => ({
  executeSql: jest.fn(),
  getDatabase: jest.fn(),
}));

const mockExecuteSql = executeSql as jest.MockedFunction<typeof executeSql>;

describe('Transaction Reactivity & Derived Metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAccountStore.setState({
      accounts: [],
      currentAccountId: 'acc-1',
      balances: {},
      dataRevision: 0,
    });
  });

  describe('calculateVaultBalances', () => {
    it('prioritizes walletId over legacy vaultType and handles single-record transfers', () => {
      const txs: Transaction[] = [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          type: 'income',
          amount: 1000,
          categoryId: 'cat-1',
          description: 'Salary',
          date: 1700000000000,
          vaultType: 'main',
          walletId: 'salary',
          isRecurring: false,
          currency: 'USD',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
        {
          id: 'tx-2',
          accountId: 'acc-1',
          type: 'expense',
          amount: 200,
          categoryId: 'cat-2',
          description: 'Groceries',
          date: 1700000001000,
          vaultType: 'main',
          walletId: 'salary',
          isRecurring: false,
          currency: 'USD',
          createdAt: 1700000001000,
          updatedAt: 1700000001000,
        },
        {
          id: 'tx-3',
          accountId: 'acc-1',
          type: 'transfer',
          amount: 300,
          categoryId: 'cat-3',
          description: 'Move to savings',
          date: 1700000002000,
          vaultType: 'salary',
          walletId: 'salary',
          destinationWalletId: 'savings',
          isRecurring: false,
          currency: 'USD',
          createdAt: 1700000002000,
          updatedAt: 1700000002000,
        },
      ];

      const result = calculateVaultBalances(txs);
      expect(result.salaryBalance).toBe(500);
      expect(result.savingsBalance).toBe(300);
      expect(result.mainBalance).toBe(0);
      expect(result.totalBalance).toBe(800);
      expect(result.availableBalance).toBe(800);
    });
  });

  describe('TransactionRepository mutations & reactivity', () => {
    it('synchronizes convertedAmount and paired transfer leg on update, and bumps dataRevision', async () => {
      const repo = new TransactionRepository();
      const now = 1700000000000;

      const outgoingLegRow = {
        id: 'tx-out',
        account_id: 'acc-1',
        type: 'expense',
        amount: 100,
        converted_amount: 100,
        category_id: 'cat-transfer',
        description: 'Transfer out',
        date: now,
        vault_type: 'main',
        wallet_id: 'main',
        destination_wallet_id: 'savings',
        is_recurring: 0,
        currency: 'USD',
        created_at: now,
        updated_at: now,
      };

      mockExecuteSql.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM transactions WHERE id = ?')) {
          return [outgoingLegRow] as any;
        }
        if (sql.includes('SELECT id FROM transactions')) {
          return [{ id: 'tx-in' }] as any;
        }
        if (sql.includes('SELECT * FROM transactions WHERE account_id = ?')) {
          return [
            { ...outgoingLegRow, amount: 250, converted_amount: 250 },
            {
              ...outgoingLegRow,
              id: 'tx-in',
              type: 'income',
              wallet_id: 'savings',
              vault_type: 'savings',
              destination_wallet_id: 'main',
              amount: 250,
              converted_amount: 250,
            },
          ] as any;
        }
        return [] as any;
      });

      const prevRevision = useAccountStore.getState().dataRevision;
      await repo.update('tx-out', { amount: 250 });

      expect(useAccountStore.getState().dataRevision).toBeGreaterThan(prevRevision);

      const updateCalls = mockExecuteSql.mock.calls.filter(([sql]) =>
        sql.startsWith('UPDATE transactions SET'),
      );
      expect(updateCalls.length).toBe(2);
      // Both outgoing and incoming transfer legs updated with new amount and converted_amount
      expect(updateCalls[0][1]).toEqual(expect.arrayContaining([250, 250, 'tx-out']));
      expect(updateCalls[1][1]).toEqual(expect.arrayContaining([250, 250, 'tx-in']));
    });

    it('deletes paired transfer counterpart leg and reverses linked goal progress on delete', async () => {
      const repo = new TransactionRepository();
      const now = 1700000000000;

      const goalTxRow = {
        id: 'tx-goal',
        account_id: 'acc-1',
        type: 'expense',
        amount: 150,
        converted_amount: 150,
        category_id: 'cat-1',
        description: 'Funded Goal: Emergency Car Fund',
        date: now,
        vault_type: 'main',
        wallet_id: 'main',
        destination_wallet_id: null,
        is_recurring: 0,
        currency: 'USD',
        created_at: now,
        updated_at: now,
      };

      mockExecuteSql.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM transactions WHERE id = ?')) {
          return [goalTxRow] as any;
        }
        if (sql.includes('SELECT id, current_amount, target_amount FROM goals')) {
          return [{ id: 'goal-1', current_amount: 450, target_amount: 1000 }] as any;
        }
        if (sql.includes('SELECT * FROM transactions WHERE account_id = ?')) {
          return [] as any;
        }
        return [] as any;
      });

      await repo.delete('tx-goal');

      const goalUpdateCall = mockExecuteSql.mock.calls.find(([sql]) =>
        sql.startsWith('UPDATE goals SET current_amount = ?'),
      );
      expect(goalUpdateCall).toBeDefined();
      expect(goalUpdateCall?.[1]?.[0]).toBe(300); // 450 - 150 = 300
    });
  });

  describe('WalletRepository.getDerivedBalances', () => {
    it('uses COALESCE(NULLIF(t.wallet_id, \'\'), t.vault_type, \'main\') to prevent double counting', async () => {
      const walletRepo = new WalletRepository();
      mockExecuteSql.mockResolvedValueOnce([
        { wallet_id: 'main', inflow: 1000, outflow: 300 },
        { wallet_id: 'savings', inflow: 300, outflow: 0 },
      ] as any);

      const balances = await walletRepo.getDerivedBalances('acc-1');
      expect(balances).toEqual({ main: 700, savings: 300 });
      const executedSql = mockExecuteSql.mock.calls[0][0];
      expect(executedSql).toContain("COALESCE(NULLIF(t.wallet_id, ''), t.vault_type, 'main') = w.id");
    });
  });
});
