// Account Store - Manages account balances (MMKV persisted for fast access)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mmkvStorage } from './middleware/mmkvStorage';
import { roundMoney, normalizeAccountBalance } from '../utils/balanceCalculator';
import { VaultType } from '../domain/vault/VaultType';

import type { AccountState } from '../types/store';

// ============================================
// Account Store
// ============================================

/**
 * Resiliently resolves the target account ID. If no explicit account ID is
 * provided, checks state.currentAccountId, falls back to authStore.currentAccountId,
 * and finally falls back to the first available balance in state.
 */
function resolveTargetAccountId(state: AccountState, requestedId?: string): string | null {
  if (requestedId) return requestedId;
  if (state.currentAccountId) return state.currentAccountId;
  try {
    const { useAuthStore } = require('./authStore');
    const authAccountId = useAuthStore.getState().currentAccountId;
    if (authAccountId) return authAccountId;
  } catch {}
  const balanceKeys = Object.keys(state.balances);
  if (balanceKeys.length > 0) return balanceKeys[0];
  return null;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      // State
      balances: {},
      currentAccountId: null,
      isLoading: false,

      // Actions
      setCurrentAccountId: (accountId) => {
        set({ currentAccountId: accountId });
      },
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

          const rawMerged = {
            ...currentBalance,
            ...updates,
            lastUpdated: Date.now(),
          };

          const newBalance = normalizeAccountBalance(rawMerged, accountId);

          return {
            balances: {
              ...state.balances,
              [accountId]: newBalance,
            },
          };
        });

        console.log('[AccountStore] Balance updated for account:', accountId);
      },

      getCurrentBalance: (accountId) => {
        const state = get();
        const targetId = resolveTargetAccountId(state, accountId);

        if (!targetId) {
          return null;
        }

        if (!state.currentAccountId && targetId) {
          set({ currentAccountId: targetId });
        }

        const bal = state.balances[targetId];
        return bal ? normalizeAccountBalance(bal, targetId) : null;
      },

      getAccountBalance: (accountId) => {
        const state = get();
        const bal = state.balances[accountId];
        return bal ? normalizeAccountBalance(bal, accountId) : null;
      },

      addToVault: (vault, amount, accountId) => {
        const state = get();
        const targetId = resolveTargetAccountId(state, accountId);
        if (!targetId) {
          console.error('[AccountStore] No current account selected');
          return;
        }

        const currentBalance = state.balances[targetId];
        if (!currentBalance) {
          console.error('[AccountStore] Current balance not found');
          return;
        }

        const normalized = normalizeAccountBalance(currentBalance, targetId);
        const vt = VaultType.parse(vault as string);
        state.updateBalance(targetId, vt.adjustBalance(normalized, amount));
      },

      subtractFromVault: (vault, amount, accountId) => {
        const state = get();
        const targetId = resolveTargetAccountId(state, accountId);
        if (!targetId) {
          console.error('[AccountStore] No current account selected');
          return;
        }

        const currentBalance = state.balances[targetId];
        if (!currentBalance) {
          console.error('[AccountStore] Current balance not found');
          return;
        }

        const normalized = normalizeAccountBalance(currentBalance, targetId);
        const vt = VaultType.parse(vault as string);
        state.updateBalance(targetId, vt.adjustBalance(normalized, -amount));
      },

      getVaultBalance: (vault, accountId) => {
        const state = get();
        const targetId = resolveTargetAccountId(state, accountId);
        if (!targetId) return 0;

        const currentBalance = state.balances[targetId];
        if (!currentBalance) return 0;

        const normalized = normalizeAccountBalance(currentBalance, targetId);
        return VaultType.parse(vault as string).getBalance(normalized);
      },

      getAvailableToSpend: (accountId) => {
        const state = get();
        const targetId = resolveTargetAccountId(state, accountId);
        if (!targetId) return 0;

        const currentBalance = state.balances[targetId];
        if (!currentBalance) return 0;

        const normalized = normalizeAccountBalance(currentBalance, targetId);
        return normalized.availableBalance;
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
      version: 1,
      migrate: (persistedState: any) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }
        const balances = persistedState.balances || {};
        const migratedBalances: Record<string, any> = {};
        for (const [id, bal] of Object.entries(balances)) {
          migratedBalances[id] = normalizeAccountBalance(bal as any, id);
        }
        return {
          ...persistedState,
          balances: migratedBalances,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const keys = Object.keys(state.balances || {});
        let hasChanges = false;
        const cleaned: Record<string, any> = {};

        for (const k of keys) {
          const orig = state.balances[k];
          const norm = normalizeAccountBalance(orig as any, k);
          cleaned[k] = norm;
          if (
            norm.salaryBalance !== orig?.salaryBalance ||
            norm.cardBalance !== orig?.cardBalance ||
            norm.emergencyBalance !== orig?.emergencyBalance ||
            norm.physicalBalance !== orig?.physicalBalance
          ) {
            hasChanges = true;
          }
        }

        if (hasChanges) {
          useAccountStore.setState({ balances: cleaned });
        }

        if (!state.currentAccountId) {
          try {
            const { useAuthStore } = require('./authStore');
            const authId = useAuthStore.getState().currentAccountId;
            if (authId) {
              useAccountStore.setState({ currentAccountId: authId });
            } else if (keys.length > 0) {
              useAccountStore.setState({ currentAccountId: keys[0] });
            }
          } catch {}
        }
      },
    }
  )
);
