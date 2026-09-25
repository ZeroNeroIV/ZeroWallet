// Account Store - Manages account balances (MMKV persisted for fast access)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mmkvStorage } from './middleware/mmkvStorage';

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
          // for balances persisted before the wallet existed)
          const m = newBalance.mainBalance ?? 0;
          const s = newBalance.savingsBalance ?? 0;
          const h = newBalance.heldBalance ?? 0;
          const sal = (newBalance as Record<string, number>).salaryBalance ?? 0;
          const em = (newBalance as Record<string, number>).emergencyBalance ?? 0;
          const ca = (newBalance as Record<string, number>).cardBalance ?? 0;
          const ph = (newBalance as Record<string, number>).physicalBalance ?? 0;

          newBalance.totalBalance = m + s + h + sal + em + ca + ph;
          newBalance.availableBalance = newBalance.totalBalance - h;

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
