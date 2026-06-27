// Account Store - Manages account balances (MMKV persisted for fast access)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mmkvStorage } from './middleware/mmkvStorage';

import { VaultType } from '../domain/vault/VaultType';
import type { AccountState } from '../types/store';

// ============================================
// Account Store
// ============================================

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      // State
      balances: {},
      isLoading: false,

      // Actions
      updateBalance: (accountId, updates) => {
        set((state) => {
          const currentBalance = state.balances[accountId] || {
            accountId,
            mainBalance: 0,
            savingsBalance: 0,
            heldBalance: 0,
            totalBalance: 0,
            availableBalance: 0,
            lastUpdated: Date.now(),
          };

          const newBalance = {
            ...currentBalance,
            ...updates,
            lastUpdated: Date.now(),
          };

          // Recalculate computed fields
          newBalance.totalBalance =
            newBalance.mainBalance +
            newBalance.savingsBalance +
            newBalance.heldBalance;

          newBalance.availableBalance =
            newBalance.mainBalance + newBalance.savingsBalance;

          return {
            balances: {
              ...state.balances,
              [accountId]: newBalance,
            },
          };
        });



        console.log('[AccountStore] Balance updated for account:', accountId);
      },

      transferBetweenVaults: (accountId, from, to, amount) => {
        set((state) => {
          const currentBalance = state.balances[accountId];

          if (!currentBalance) {
            console.error('[AccountStore] Account not found:', accountId);
            return state;
          }

          const fromVt = VaultType.parse(from);
          const fromBalance = fromVt.getBalance(currentBalance);

          if (fromBalance < amount) {
            console.error('[AccountStore] Insufficient balance in', from);
            throw new Error(`Insufficient balance in ${from} vault`);
          }

          const toVt = VaultType.parse(to);
          const newBalance = { ...currentBalance };
          newBalance[fromVt.key] -= amount;
          newBalance[toVt.key] += amount;

          newBalance.totalBalance =
            newBalance.mainBalance +
            newBalance.savingsBalance +
            newBalance.heldBalance;

          newBalance.availableBalance =
            newBalance.mainBalance + newBalance.savingsBalance;

          newBalance.lastUpdated = Date.now();

          return {
            balances: {
              ...state.balances,
              [accountId]: newBalance,
            },
          };
        });
      },

      getCurrentBalance: () => {
        const state = get();
        const { useAuthStore } = require('./authStore');
        const currentAccountId = useAuthStore.getState().currentAccountId;

        if (!currentAccountId) {
          return null;
        }

        return state.balances[currentAccountId] || null;
      },

      getAccountBalance: (accountId) => {
        const state = get();
        return state.balances[accountId] || null;
      },

      initializeBalance: (accountId) => {
        set((state) => {
          if (state.balances[accountId]) {
            console.log('[AccountStore] Balance already initialized for:', accountId);
            return state;
          }

          return {
            balances: {
              ...state.balances,
              [accountId]: {
                accountId,
                mainBalance: 0,
                savingsBalance: 0,
                heldBalance: 0,
                totalBalance: 0,
                availableBalance: 0,
                lastUpdated: Date.now(),
              },
            },
          };
        });

        console.log('[AccountStore] Balance initialized for account:', accountId);
      },

      resetBalances: () => {
        set({ balances: {} });



        console.log('[AccountStore] All balances reset');
      },

      clearAccounts: () => {
        set({ balances: {}, isLoading: false });



        console.log('[AccountStore] All accounts cleared');
      },
    }),
    {
      name: 'account-storage',
      storage: mmkvStorage,
    }
  )
);
