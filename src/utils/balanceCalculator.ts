import type { Transaction } from '../types/models';
import { VaultType } from '../domain/vault/VaultType';

export interface VaultBalances {
  mainBalance: number;
  savingsBalance: number;
  heldBalance: number;
  salaryBalance: number;
  emergencyBalance: number;
  cardBalance: number;
  physicalBalance: number;
  totalBalance: number;
  availableBalance: number;
}

export function calculateVaultBalances(transactions: Transaction[]): VaultBalances {
  const balances = {
    mainBalance: 0,
    savingsBalance: 0,
    heldBalance: 0,
    salaryBalance: 0,
    emergencyBalance: 0,
    cardBalance: 0,
    physicalBalance: 0,
  };

  for (const tx of transactions) {
    const amount = tx.convertedAmount ?? tx.amount;
    const value = amount * (tx.type === 'income' ? 1 : -1);
    try {
      const vt = VaultType.parse(tx.vaultType);
      balances[vt.key] += value;
    } catch {
      // Unknown legacy vault value: count toward the main wallet so the
      // money is never silently dropped from totals
      balances.mainBalance += value;
    }
  }

  const totalBalance =
    balances.mainBalance +
    balances.savingsBalance +
    balances.heldBalance +
    balances.salaryBalance +
    balances.emergencyBalance +
    balances.cardBalance +
    balances.physicalBalance;
  // Everything except the held (Recurring) wallet is available to spend
  const availableBalance = totalBalance - balances.heldBalance;

  return { ...balances, totalBalance, availableBalance };
}
