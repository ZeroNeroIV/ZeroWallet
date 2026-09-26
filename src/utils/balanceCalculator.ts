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

/**
 * Purpose: Round money to 3 decimals (the app's display precision).
 * Floating-point accumulation (e.g. 499.99999999994 instead of 500) makes
 * exact-amount operations like "transfer MAX" fail comparisons, so every
 * balance choke point normalizes through here.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
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

  balances.mainBalance = roundMoney(balances.mainBalance);
  balances.savingsBalance = roundMoney(balances.savingsBalance);
  balances.heldBalance = roundMoney(balances.heldBalance);
  balances.salaryBalance = roundMoney(balances.salaryBalance);
  balances.emergencyBalance = roundMoney(balances.emergencyBalance);
  balances.cardBalance = roundMoney(balances.cardBalance);
  balances.physicalBalance = roundMoney(balances.physicalBalance);

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
