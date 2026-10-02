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
import { WalletRepository } from '../database/repositories/WalletRepository';
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
  const walletRepo = new WalletRepository();
  const txs = await txRepo.findByAccount(accountId);
  const recalculated = calculateVaultBalances(txs);
  useAccountStore.getState().updateBalance(accountId, recalculated);
  await walletRepo.getDerivedBalances(accountId);
}

export async function transferBetweenWallets(
  accountId: string,
  userId: string,
  from: string,
  to: string,
  amount: number,
  description?: string,
  currency: string = 'USD',
  allowOverdraft: boolean = false,
): Promise<void> {
  if (!amount || amount <= 0) {
    throw new Error('Transfer amount must be positive');
  }
  if (from === to) {
    throw new Error('Source and destination wallets must be different');
  }

  const txRepo = new TransactionRepository();
  const categoryRepo = new CategoryRepository();
  const walletRepo = new WalletRepository();

  // 1. Fetch wallet names and derived balances
  const [fromWallet, toWallet, derivedBalances] = await Promise.all([
    walletRepo.findByAccountAndId(accountId, from),
    walletRepo.findByAccountAndId(accountId, to),
    walletRepo.getDerivedBalances(accountId),
  ]);

  const fromName = fromWallet?.name || walletShortName(from as VaultType) || from;
  const toName = toWallet?.name || walletShortName(to as VaultType) || to;
  const fromBalance = derivedBalances[from] ?? 0;

  // 2. Balance check against pure derived balance (unless overdraft explicitly permitted or credit wallet)
  const isCredit = fromWallet?.icon?.includes('credit') || fromWallet?.name?.toLowerCase().includes('credit');
  if (!allowOverdraft && !isCredit && roundMoney(fromBalance) < roundMoney(amount)) {
    throw new Error(`Insufficient funds in ${fromName}. Available: ${currency} ${fromBalance.toFixed(2)}`);
  }

  const note = description?.trim() || `Transfer ${fromName} → ${toName}`;
  const outCategory = await categoryRepo.ensureTransferCategory(userId, 'expense');
  const inCategory = await categoryRepo.ensureTransferCategory(userId, 'income');
  const now = Date.now();

  // Outgoing leg
  await txRepo.create({
    accountId,
    type: 'expense',
    amount,
    categoryId: outCategory.id,
    description: `Transfer out: ${note}`,
    date: now,
    vaultType: from as VaultType,
    walletId: from,
    destinationWalletId: to,
    isRecurring: false,
    currency,
  });

  // Incoming leg
  await txRepo.create({
    accountId,
    type: 'income',
    amount,
    categoryId: inCategory.id,
    description: `Transfer in: ${note}`,
    date: now,
    vaultType: to as VaultType,
    walletId: to,
    destinationWalletId: from,
    isRecurring: false,
    currency,
  });

  // Refresh persisted balances for legacy listeners
  const updatedTxs = await txRepo.findByAccount(accountId);
  const updatedVaults = calculateVaultBalances(updatedTxs);
  useAccountStore.getState().updateBalance(accountId, updatedVaults);
}
