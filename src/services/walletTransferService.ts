/**
 * Purpose: Move money between two wallets of the same account
 *
 * Inputs:
 *   - accountId (string): Account owning both wallets
 *   - userId (string): Owner (for Transfer category resolution)
 *   - from / to (VaultType): Source and destination wallets (must differ)
 *   - amount (number): Positive amount to move
 *   - description (string, optional): Note shown on both legs
 *   - currency (string, optional): Defaults to USD
 *
 * Outputs:
 *   - Returns (Promise<void>): Completes when both legs are recorded
 *
 * Side effects:
 *   - Creates an expense leg (source wallet) and income leg (dest wallet)
 *     under Transfer categories so the move is visible in history and
 *     survives balance recalculation from transactions
 *   - Recalculates and persists wallet balances for the account
 */

import { TransactionRepository } from '../database/repositories/TransactionRepository';
import { CategoryRepository } from '../database/repositories/CategoryRepository';
import { calculateVaultBalances, roundMoney } from '../utils/balanceCalculator';
import { useAccountStore } from '../store/accountStore';
import { walletShortName } from '../utils/wallets';
import type { VaultType } from '../types/models';

/**
 * Purpose: Recalculate wallet balances from the database and persist them.
 * Call when entering money screens so MAX-style exact-amount operations
 * never run against stale cached balances.
 */
export async function syncBalancesFromDatabase(accountId: string): Promise<void> {
  const txRepo = new TransactionRepository();
  const recalculated = calculateVaultBalances(await txRepo.findByAccount(accountId));
  useAccountStore.getState().updateBalance(accountId, recalculated);
}

export async function transferBetweenWallets(
  accountId: string,
  userId: string,
  from: VaultType,
  to: VaultType,
  amount: number,
  description?: string,
  currency: string = 'USD',
): Promise<void> {
  if (!amount || amount <= 0) {
    throw new Error('Transfer amount must be positive');
  }
  if (from === to) {
    throw new Error('Source and destination wallets must be different');
  }

  const txRepo = new TransactionRepository();
  const categoryRepo = new CategoryRepository();

  // Balance check against freshly calculated (DB-truth) balances.
  // Both sides are normalized to 3 decimals so an exact MAX amount
  // always passes instead of tripping on float dust (499.9999999 < 500).
  const current = calculateVaultBalances(await txRepo.findByAccount(accountId));
  const fromKey = `${from}Balance` as keyof typeof current;
  if (roundMoney(current[fromKey] ?? 0) < roundMoney(amount)) {
    throw new Error(`Insufficient balance in ${walletShortName(from)} wallet`);
  }

  const note = description?.trim() || `Transfer ${walletShortName(from)} → ${walletShortName(to)}`;
  const outCategory = await categoryRepo.ensureTransferCategory(userId, 'expense');
  const inCategory = await categoryRepo.ensureTransferCategory(userId, 'income');
  const now = Date.now();

  await txRepo.create({
    accountId,
    type: 'expense',
    amount,
    categoryId: outCategory.id,
    description: `Transfer out: ${note}`,
    date: now,
    vaultType: from,
    isRecurring: false,
    currency,
  });

  await txRepo.create({
    accountId,
    type: 'income',
    amount,
    categoryId: inCategory.id,
    description: `Transfer in: ${note}`,
    date: now,
    vaultType: to,
    isRecurring: false,
    currency,
  });

  const updated = calculateVaultBalances(await txRepo.findByAccount(accountId));
  useAccountStore.getState().updateBalance(accountId, updated);
}
