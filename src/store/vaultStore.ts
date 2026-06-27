// Vault Store - Helper methods for vault operations (uses accountStore internally)
import { create } from 'zustand';
import { VaultType } from '../domain/vault/VaultType';
import type { VaultState } from '../types/store';
import { useAccountStore } from './accountStore';
import { useAuthStore } from './authStore';

function vaultOperation(vault: string, amount: number, sign: 1 | -1): void {
  const accountStore = useAccountStore.getState();
  const authStore = useAuthStore.getState();
  const currentAccountId = authStore.currentAccountId;

  if (!currentAccountId) {
    console.error('[VaultStore] No current account selected');
    return;
  }

  const currentBalance = accountStore.getCurrentBalance();
  if (!currentBalance) {
    console.error('[VaultStore] Current balance not found');
    return;
  }

  const vt = VaultType.parse(vault);
  accountStore.updateBalance(currentAccountId, vt.adjustBalance(currentBalance, amount * sign));
}

export const useVaultStore = create<VaultState>()((set, get) => ({
  addToVault: (vault, amount) => vaultOperation(vault, amount, 1),

  subtractFromVault: (vault, amount) => vaultOperation(vault, amount, -1),

  getVaultBalance: (vault) => {
    const accountStore = useAccountStore.getState();
    const currentBalance = accountStore.getCurrentBalance();
    if (!currentBalance) return 0;
    return VaultType.parse(vault).getBalance(currentBalance);
  },

  getAvailableToSpend: () => {
    const accountStore = useAccountStore.getState();
    const currentBalance = accountStore.getCurrentBalance();
    if (!currentBalance) return 0;
    return currentBalance.availableBalance;
  },
}));
