// Account Store - Manages account balances (MMKV persisted for fast access)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mmkvStorage } from './middleware/mmkvStorage';
import { roundMoney } from '../utils/balanceCalculator';

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
            salaryBalance: 0,
            emergencyBalance: 0,
            cardBalance: 0,
            physicalBalance: 0,
            totalBalance: 0,
            availableBalance: 0,
            lastUpdated: Date.now(),
          };

          const newBalance = {
            ...currentBalance,
            ...updates,
            lastUpdated: Date.now(),
          };

          // Recalculate computed fields (missing wallet keys default to 0
          // for balances persisted before the wallet existed). Every wallet
          // value is rounded to 3 decimals so float dust can never break
          // exact-amount comparisons (e.g. transfer MAX). Totals sum every
          // *Balance key dynamically so custom wallets are included.
          const nb = newBalance as unknown as Record<string, number>;
          // Keep the 7 built-in keys present even on legacy shapes
          for (const key of [
            'mainBalance',
            'savingsBalance',
            'heldBalance',
            'salaryBalance',
            'emergencyBalance',
            'cardBalance',
            'physicalBalance',
          ]) {
            if (!(key in nb)) nb[key] = 0;
          }
          let total = 0;
          for (const key of Object.keys(nb).filter(
            (k) =>
              k !== 'totalBalance' &&
              k !== 'availableBalance' &&
              k !== 'lastUpdated' &&
              k !== 'accountId' &&
              k.endsWith('Balance')
          )) {
            nb[key] = roundMoney(nb[key] ?? 0);
            total += nb[key];
          }
          newBalance.totalBalance = roundMoney(total);
          newBalance.availableBalance = roundMoney(total - (nb.heldBalance ?? 0));

          return {
            balances: {
              ...state.balances,
              [accountId]: newBalance,
            },
          };
        });



        console.log('[AccountStore] Balance updated for account:', accountId);
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
                salaryBalance: 0,
                emergencyBalance: 0,
                cardBalance: 0,
                physicalBalance: 0,
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
