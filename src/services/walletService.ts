// Wallet Service — Isolated operations and telemetry for individual wallets
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { WalletRepository } from '../database/repositories/WalletRepository';
import { TransactionRepository } from '../database/repositories/TransactionRepository';
import { AccountRepository } from '../database/repositories/AccountRepository';
import type { Wallet, Transaction } from '../types/models';
import type { CashFlow30DayPoint } from './dashboardService';

export interface WalletDetailData {
  wallet: Wallet;
  currency: string;
  derivedBalance: number;
  transactions: Transaction[];
  trend30Day: CashFlow30DayPoint[];
  net30DayChange: number;
  totalInflow30Day: number;
  totalOutflow30Day: number;
  transactionCount: number;
}

export class WalletService {
  private walletRepo = new WalletRepository();
  private transactionRepo = new TransactionRepository();
  private accountRepo = new AccountRepository();

  async loadWalletDetail(accountId: string, walletId: string): Promise<WalletDetailData | null> {
    const [wallet, account, allDerivedBalances, allWalletTxs] = await Promise.all([
      this.walletRepo.findByAccountAndId(accountId, walletId),
      this.accountRepo.findById(accountId),
      this.walletRepo.getDerivedBalances(accountId),
      this.transactionRepo.findByWallet(walletId, accountId, 100),
    ]);

    if (!wallet) return null;

    const currency = account?.currency || 'USD';
    const derivedBalance = allDerivedBalances[walletId] ?? 0;

    // Calculate 30-day trend for this wallet
    const today = endOfDay(new Date());
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 29));

    const dayMap = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < 30; i++) {
      const d = startOfDay(subDays(new Date(), 29 - i));
      const key = format(d, 'yyyy-MM-dd');
      dayMap.set(key, { income: 0, expense: 0 });
    }

    let totalInflow30Day = 0;
    let totalOutflow30Day = 0;

    for (const t of allWalletTxs) {
      if (t.date >= thirtyDaysAgo.getTime() && t.date <= today.getTime()) {
        const key = format(new Date(t.date), 'yyyy-MM-dd');
        const entry = dayMap.get(key);
        const amt = t.convertedAmount ?? t.amount;

        // Is this an inflow or outflow for THIS specific wallet?
        const isDestination = t.destinationWalletId === walletId;
        const isSource = t.walletId === walletId || t.vaultType === walletId;

        if (t.type === 'income' && isSource) {
          if (entry) entry.income += amt;
          totalInflow30Day += amt;
        } else if (t.type === 'expense' && isSource) {
          if (entry) entry.expense += amt;
          totalOutflow30Day += amt;
        } else if (t.type === 'transfer') {
          if (isDestination) {
            if (entry) entry.income += amt;
            totalInflow30Day += amt;
          } else if (isSource) {
            if (entry) entry.expense += amt;
            totalOutflow30Day += amt;
          }
        }
      }
    }

    let cumulative = 0;
    let net30DayChange = 0;
    const trend30Day: CashFlow30DayPoint[] = [];

    dayMap.forEach((values, dateStr) => {
      const delta = values.income - values.expense;
      cumulative += delta;
      net30DayChange += delta;
      const d = new Date(dateStr);
      trend30Day.push({
        date: dateStr,
        day: format(d, 'MMM d'),
        value: cumulative,
        income: values.income,
        expense: values.expense,
      });
    });

    return {
      wallet,
      currency,
      derivedBalance,
      transactions: allWalletTxs,
      trend30Day,
      net30DayChange,
      totalInflow30Day,
      totalOutflow30Day,
      transactionCount: allWalletTxs.length,
    };
  }
}
