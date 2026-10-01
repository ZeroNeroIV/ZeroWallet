// Vault Store - Backward-compatible adapter delegating directly to accountStore
import { create } from 'zustand';
import type { VaultState } from '../types/store';
import { useAccountStore } from './accountStore';

export const useVaultStore = create<VaultState>()(() => ({
  addToVault: (vault, amount) => useAccountStore.getState().addToVault(vault, amount),

  subtractFromVault: (vault, amount) => useAccountStore.getState().subtractFromVault(vault, amount),

  getVaultBalance: (vault) => useAccountStore.getState().getVaultBalance(vault),

  getAvailableToSpend: () => useAccountStore.getState().getAvailableToSpend(),
}));
