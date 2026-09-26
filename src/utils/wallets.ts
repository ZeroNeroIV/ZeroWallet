/**
 * Purpose: Wallet identity — wallets are the app's money containers, each
 * distinguished by a category
 *
 * Inputs: None (pure mappings over VaultType)
 *
 * Outputs:
 *   - Exports wallet display names, categories, icons and descriptions
 *
 * Side effects: None
 */

import { VAULT_TYPE_VALUES, walletBalanceKey } from '../domain/vault/VaultType';
import type { VaultType } from '../types/models';

export interface WalletMeta {
  name: string;
  shortName: string;
  category: string;
  icon: string;
  description: string;
}

export const WALLET_META: Record<VaultType, WalletMeta> = {
  main: {
    name: 'Investment Wallet',
    shortName: 'Investment',
    category: 'Investment',
    icon: 'trending-up',
    description: 'Active money — spend, use and grow it',
  },
  savings: {
    name: 'Savings Wallet',
    shortName: 'Savings',
    category: 'Savings',
    icon: 'piggy-bank-outline',
    description: 'Money set aside for future goals',
  },
  held: {
    name: 'Recurring Wallet',
    shortName: 'Recurring',
    category: 'Recurring',
    icon: 'repeat',
    description: 'Reserved for bills and recurring commitments',
  },
  salary: {
    name: 'Salary Wallet',
    shortName: 'Salary',
    category: 'Salary',
    icon: 'cash-multiple',
    description: 'Where your salary lands each payday',
  },
  emergency: {
    name: 'Emergency Funds Wallet',
    shortName: 'Emergency',
    category: 'Emergency Funds',
    icon: 'lifebuoy',
    description: 'Emergency fund — touch only when it matters',
  },
  card: {
    name: 'Card Wallet',
    shortName: 'Card',
    category: 'Card',
    icon: 'credit-card-outline',
    description: 'Money available on your card',
  },
  physical: {
    name: 'Physical Wallet',
    shortName: 'Physical',
    category: 'Physical Cash',
    icon: 'wallet-outline',
    description: 'Physical cash on hand',
  },
};

/** All wallets in display order */
export const ALL_WALLETS: VaultType[] = [...VAULT_TYPE_VALUES];

export function walletName(vault: VaultType): string {
  return WALLET_META[vault]?.name ?? `${vault} wallet`;
}

export function walletCategory(vault: VaultType): string {
  return WALLET_META[vault]?.category ?? vault;
}

export function walletShortName(vault: VaultType): string {
  return WALLET_META[vault]?.shortName ?? vault;
}

/** Read a wallet balance from any balance-like object (tolerates legacy shapes) */
export function getWalletBalance(
  balances: Record<string, number | undefined> | undefined,
  vault: string,
): number {
  if (!balances) return 0;
  return balances[walletBalanceKey(vault)] ?? 0;
}

export function ordinalDay(day: number): string {
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${day}${suffix}`;
}
