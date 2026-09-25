/**
 * Purpose: Wallet identity — wallets are the app's money containers, each
 * distinguished by a category (Investment, Savings, Recurring)
 *
 * Inputs: None (pure mappings over VaultType)
 *
 * Outputs:
 *   - Exports wallet display names, categories, icons and descriptions
 *
 * Side effects: None
 */

import type { VaultType } from '../types/models';

export interface WalletMeta {
  name: string;
  category: 'Investment' | 'Savings' | 'Recurring';
  icon: string;
  description: string;
}

export const WALLET_META: Record<VaultType, WalletMeta> = {
  main: {
    name: 'Investment Wallet',
    category: 'Investment',
    icon: 'trending-up',
    description: 'Active money — spend, use and grow it',
  },
  savings: {
    name: 'Savings Wallet',
    category: 'Savings',
    icon: 'piggy-bank-outline',
    description: 'Money set aside for future goals',
  },
  held: {
    name: 'Recurring Wallet',
    category: 'Recurring',
    icon: 'repeat',
    description: 'Reserved for bills and recurring commitments',
  },
};

export function walletName(vault: VaultType): string {
  return WALLET_META[vault].name;
}

export function walletCategory(vault: VaultType): WalletMeta['category'] {
  return WALLET_META[vault].category;
}

export function walletShortName(vault: VaultType): string {
  return vault === 'main' ? 'Investment' : vault === 'savings' ? 'Savings' : 'Recurring';
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
