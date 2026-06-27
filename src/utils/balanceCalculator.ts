import type { Transaction } from '../types/models';
import { VaultType } from '../domain/vault/VaultType';

export interface VaultBalances {
  mainBalance: number;
  savingsBalance: number;
  heldBalance: number;
  totalBalance: number;
  availableBalance: number;
}

export function calculateVaultBalances(transactions: Transaction[]): VaultBalances {
  const balances = { mainBalance: 0, savingsBalance: 0, heldBalance: 0 };

  for (const tx of transactions) {
    const amount = tx.convertedAmount ?? tx.amount;
    const value = amount * (tx.type === 'income' ? 1 : -1);
    const vt = VaultType.parse(tx.vaultType);
    balances[vt.key] += value;
  }

  const totalBalance = balances.mainBalance + balances.savingsBalance + balances.heldBalance;
  const availableBalance = balances.mainBalance + balances.savingsBalance;

  return { ...balances, totalBalance, availableBalance };
}
