import { VaultType } from '../src/domain/vault/VaultType';
import {
  calculateVaultBalances,
  normalizeAccountBalance,
  roundMoney,
} from '../src/utils/balanceCalculator';
import { formatWalletName } from '../src/database/dataHealer';
import type { Transaction } from '../src/types/models';

describe('Backward Compatibility & Data Format Conversion', () => {
  describe('VaultType.parse backward compatibility', () => {
    it('handles legacy aliases correctly', () => {
      expect(VaultType.parse('investment').type).toBe('main');
      expect(VaultType.parse('invest').type).toBe('main');
      expect(VaultType.parse('bills').type).toBe('held');
      expect(VaultType.parse('recurring').type).toBe('held');
      expect(VaultType.parse('cash').type).toBe('physical');
      expect(VaultType.parse('emergency_fund').type).toBe('emergency');
      expect(VaultType.parse('emergency-fund').type).toBe('emergency');
      expect(VaultType.parse('credit').type).toBe('card');
      expect(VaultType.parse('debit').type).toBe('card');
    });

    it('handles case-insensitivity and whitespace', () => {
      expect(VaultType.parse(' MAIN ').type).toBe('main');
      expect(VaultType.parse('SAVINGS').type).toBe('savings');
      expect(VaultType.parse('HELD').type).toBe('held');
      expect(VaultType.parse('Salary').type).toBe('salary');
    });

    it('tolerates null, undefined, or empty strings without throwing', () => {
      expect(VaultType.parse(null).type).toBe('main');
      expect(VaultType.parse(undefined).type).toBe('main');
      expect(VaultType.parse('').type).toBe('main');
      expect(VaultType.parse(123 as any).type).toBe('main');
    });

    it('supports custom wallet identifiers', () => {
      const custom = VaultType.parse('w_crypto123');
      expect(custom.type).toBe('w_crypto123');
      expect(custom.key).toBe('w_crypto123Balance' as any);
    });

    it('correctly gets and adjusts balance for custom wallets', () => {
      const custom = VaultType.parse('w_crypto');
      const balances: any = { w_cryptoBalance: 150 };
      expect(custom.getBalance(balances)).toBe(150);
      expect(custom.adjustBalance(balances, 50)).toEqual({ w_cryptoBalance: 200 });
    });
  });

  describe('normalizeAccountBalance', () => {
    it('converts legacy 3-vault balances to 7-wallet structure', () => {
      const legacy = {
        accountId: 'acc-1',
        mainBalance: 1000,
        savingsBalance: 500,
        heldBalance: 200,
        totalBalance: 1700,
        availableBalance: 1500,
      };

      const normalized = normalizeAccountBalance(legacy, 'acc-1');

      expect(normalized.accountId).toBe('acc-1');
      expect(normalized.mainBalance).toBe(1000);
      expect(normalized.savingsBalance).toBe(500);
      expect(normalized.heldBalance).toBe(200);
      expect(normalized.salaryBalance).toBe(0);
      expect(normalized.emergencyBalance).toBe(0);
      expect(normalized.cardBalance).toBe(0);
      expect(normalized.physicalBalance).toBe(0);
      expect(normalized.totalBalance).toBe(1700);
      expect(normalized.availableBalance).toBe(1500);
    });

    it('heals corrupted, NaN, or string values', () => {
      const corrupt = {
        accountId: 'acc-corrupt',
        mainBalance: '500' as any,
        savingsBalance: NaN,
        heldBalance: undefined,
        salaryBalance: null,
      };

      const normalized = normalizeAccountBalance(corrupt, 'acc-corrupt');

      expect(normalized.mainBalance).toBe(500);
      expect(normalized.savingsBalance).toBe(0);
      expect(normalized.heldBalance).toBe(0);
      expect(normalized.salaryBalance).toBe(0);
      expect(normalized.totalBalance).toBe(500);
      expect(normalized.availableBalance).toBe(500);
    });

    it('migrates legacy wallet names like cashBalance and investmentBalance', () => {
      const legacyNamed = {
        accountId: 'acc-2',
        cashBalance: 250,
        investmentBalance: 800,
        billsBalance: 100,
      };

      const normalized = normalizeAccountBalance(legacyNamed, 'acc-2');

      expect(normalized.physicalBalance).toBe(250);
      expect(normalized.mainBalance).toBe(800);
      expect(normalized.heldBalance).toBe(100);
      expect(normalized.totalBalance).toBe(1150);
      expect(normalized.availableBalance).toBe(1050);
    });
  });

  describe('calculateVaultBalances with legacy and custom transactions', () => {
    it('calculates correct balances from transactions with legacy aliases', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          accountId: 'acc-1',
          type: 'income',
          amount: 1000,
          categoryId: 'c1',
          description: 'Salary',
          date: Date.now(),
          vaultType: 'investment' as any, // legacy alias for main
          isRecurring: false,
          currency: 'USD',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: '2',
          accountId: 'acc-1',
          type: 'expense',
          amount: 200,
          categoryId: 'c2',
          description: 'Cash spend',
          date: Date.now(),
          vaultType: 'cash' as any, // legacy alias for physical
          isRecurring: false,
          currency: 'USD',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: '3',
          accountId: 'acc-1',
          type: 'income',
          amount: 500,
          categoryId: 'c3',
          description: 'Crypto',
          date: Date.now(),
          vaultType: 'w_crypto', // custom wallet
          isRecurring: false,
          currency: 'USD',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const balances = calculateVaultBalances(transactions);

      expect(balances.mainBalance).toBe(1000);
      expect(balances.physicalBalance).toBe(-200);
      expect((balances as any).w_cryptoBalance).toBe(500);
      expect(balances.totalBalance).toBe(1300);
      expect(balances.availableBalance).toBe(1300);
    });

    it('tolerates transactions with null or missing vaultType or amount', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          accountId: 'acc-1',
          type: 'income',
          amount: 50,
          categoryId: 'c1',
          description: 'Broken tx',
          date: Date.now(),
          vaultType: null as any,
          isRecurring: false,
          currency: 'USD',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: '2',
          accountId: 'acc-1',
          type: 'income',
          amount: '150' as any,
          categoryId: 'c1',
          description: 'String amount tx',
          date: Date.now(),
          vaultType: 'savings',
          isRecurring: false,
          currency: 'USD',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const balances = calculateVaultBalances(transactions);

      expect(balances.mainBalance).toBe(50);
      expect(balances.savingsBalance).toBe(150);
      expect(balances.totalBalance).toBe(200);
    });
  });

  describe('formatWalletName', () => {
    it('returns official display names for built-in wallet keys', () => {
      expect(formatWalletName('main')).toBe('Investment Wallet');
      expect(formatWalletName('savings')).toBe('Savings Wallet');
      expect(formatWalletName('held')).toBe('Recurring Wallet');
      expect(formatWalletName('salary')).toBe('Salary Wallet');
      expect(formatWalletName('emergency')).toBe('Emergency Funds Wallet');
      expect(formatWalletName('card')).toBe('Card Wallet');
      expect(formatWalletName('physical')).toBe('Physical Wallet');
    });

    it('formats custom slug wallet identifiers cleanly', () => {
      expect(formatWalletName('crypto')).toBe('Crypto');
      expect(formatWalletName('w_crypto-9a2f')).toBe('Crypto');
      expect(formatWalletName('w_business-travel-9a2f')).toBe('Business Travel');
      expect(formatWalletName('side_hustle')).toBe('Side Hustle');
      expect(formatWalletName('vacation_savings')).toBe('Vacation Savings');
    });

    it('handles empty or null vault keys safely', () => {
      expect(formatWalletName('')).toBe('Wallet');
      expect(formatWalletName(null as any)).toBe('Wallet');
      expect(formatWalletName(undefined as any)).toBe('Wallet');
    });
  });
});
