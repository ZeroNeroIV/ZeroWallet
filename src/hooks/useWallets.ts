/**
 * Purpose: Load the current account's wallets (ensuring defaults exist)
 *
 * Inputs: None (reads current account from auth store)
 *
 * Outputs:
 *   - Returns (wallets, loading, refresh) for wallet pickers and lists
 *
 * Side effects:
 *   - Seeds the 7 built-in wallets on first load (idempotent)
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { WalletRepository } from '../database/repositories/WalletRepository';
import type { Wallet } from '../types/models';

export function useWallets() {
  const currentAccountId = useAuthStore((s) => s.currentAccountId);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<Wallet[]> => {
    if (!currentAccountId) {
      setWallets([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const list = await new WalletRepository().ensureDefaultWallets(currentAccountId);
      setWallets(list);
      return list;
    } catch (error) {
      console.error('[useWallets] Failed to load wallets:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentAccountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { wallets, loading, refresh };
}
