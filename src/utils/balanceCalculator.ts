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
  const balances: Record<string, number> = {
    mainBalance: 0,
    savingsBalance: 0,
    heldBalance: 0,
    salaryBalance: 0,
    emergencyBalance: 0,
    cardBalance: 0,
    physicalBalance: 0,
  };

  for (const tx of transactions) {
    const rawAmount = tx.convertedAmount ?? tx.amount;
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount)) continue;

    const value = amount * (tx.type === 'income' ? 1 : -1);
    const vt = VaultType.parse(tx.vaultType);
    const key = vt.key;

    if (balances[key] === undefined) {
      balances[key] = 0;
    }
    balances[key] += value;
  }

  let totalBalance = 0;
  for (const [k, v] of Object.entries(balances)) {
    balances[k] = roundMoney(v);
    totalBalance += balances[k];
  }

  totalBalance = roundMoney(totalBalance);
  // Everything except the held (Recurring) wallet is available to spend
  const availableBalance = roundMoney(totalBalance - (balances.heldBalance ?? 0));

  return {
    mainBalance: balances.mainBalance ?? 0,
    savingsBalance: balances.savingsBalance ?? 0,
    heldBalance: balances.heldBalance ?? 0,
    salaryBalance: balances.salaryBalance ?? 0,
    emergencyBalance: balances.emergencyBalance ?? 0,
    cardBalance: balances.cardBalance ?? 0,
    physicalBalance: balances.physicalBalance ?? 0,
    ...balances,
    totalBalance,
    availableBalance,
  };
}

/**
 * Normalizes any legacy or partially formed balance record into a
 * valid, fully populated 7-wallet AccountBalance.
 */
export function normalizeAccountBalance(
  raw: Record<string, any> | null | undefined,
  fallbackAccountId: string = ''
): AccountBalance & Record<string, any> {
  if (!raw || typeof raw !== 'object') {
    return {
      accountId: fallbackAccountId,
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
    } as any;
  }

  const result: Record<string, any> = {
    ...raw,
    accountId: raw.accountId || fallbackAccountId,
    mainBalance: roundMoney(Number(raw.mainBalance) || 0),
    savingsBalance: roundMoney(Number(raw.savingsBalance) || 0),
    heldBalance: roundMoney(Number(raw.heldBalance) || 0),
    salaryBalance: roundMoney(Number(raw.salaryBalance) || 0),
    emergencyBalance: roundMoney(Number(raw.emergencyBalance) || 0),
    cardBalance: roundMoney(Number(raw.cardBalance) || 0),
    physicalBalance: roundMoney(Number(raw.physicalBalance) || 0),
    lastUpdated:
      typeof raw.lastUpdated === 'number' && !isNaN(raw.lastUpdated)
        ? raw.lastUpdated
        : Date.now(),
  };

  // Convert and remove legacy wallet names if present
  if (raw.cashBalance) {
    if (!result.physicalBalance) {
      result.physicalBalance = roundMoney(Number(raw.cashBalance) || 0);
    }
    delete result.cashBalance;
  }
  if (raw.investmentBalance) {
    if (!result.mainBalance) {
      result.mainBalance = roundMoney(Number(raw.investmentBalance) || 0);
    }
    delete result.investmentBalance;
  }
  if (raw.billsBalance) {
    if (!result.heldBalance) {
      result.heldBalance = roundMoney(Number(raw.billsBalance) || 0);
    }
    delete result.billsBalance;
  }

  // Recalculate total across all *Balance fields
  let total = 0;
  for (const [k, v] of Object.entries(result)) {
    if (k.endsWith('Balance') && k !== 'totalBalance' && k !== 'availableBalance') {
      const num = roundMoney(Number(v) || 0);
      result[k] = num;
      total += num;
    }
  }

  result.totalBalance = roundMoney(total);
  result.availableBalance = roundMoney(total - (result.heldBalance ?? 0));

  return result as any;
}
