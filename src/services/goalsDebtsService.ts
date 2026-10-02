/**
 * Purpose: Unified Service for Goals & Debts intelligence in ZeroWallet.
 * 
 * Implements Simplizum principles:
 * - Mathematical accuracy for goal funding & debt amortization
 * - Derived ledger tracking: funding a goal or settling a debt logs wallet transactions
 * - High-speed state resolution for Net Position & Master Hairline Burn gauges
 */

import { GoalRepository } from '../database/repositories/GoalRepository';
import { DebtRepository } from '../database/repositories/DebtRepository';
import { TransactionRepository } from '../database/repositories/TransactionRepository';
import { CategoryRepository } from '../database/repositories/CategoryRepository';
import { AccountRepository } from '../database/repositories/AccountRepository';
import type { Goal, Debt, DebtStats, TransactionInput } from '../types/models';

export interface GoalsSummary {
  totalTarget: number;
  totalSaved: number;
  totalRemaining: number;
  overallPercentage: number;
  activeCount: number;
  completedCount: number;
  currency: string;
}

export interface DebtsSummary {
  totalLentOutstanding: number;
  totalBorrowedOutstanding: number;
  netPosition: number; // Lent - Borrowed
  overdueCount: number;
  pendingLentCount: number;
  pendingBorrowedCount: number;
  currency: string;
}

export class GoalsDebtsService {
  private goalRepo = new GoalRepository();
  private debtRepo = new DebtRepository();
  private txRepo = new TransactionRepository();
  private categoryRepo = new CategoryRepository();
  private accountRepo = new AccountRepository();

  /**
   * Fetches goals summary and list
   */
  async getGoalsData(accountId: string): Promise<{
    activeGoals: Goal[];
    completedGoals: Goal[];
    summary: GoalsSummary;
  }> {
    const goals = accountId ? await this.goalRepo.findByAccount(accountId) : [];
    const account = accountId ? await this.accountRepo.findById(accountId) : null;
    const currency = account?.currency || 'USD';

    const activeGoals: Goal[] = [];
    const completedGoals: Goal[] = [];

    let totalTarget = 0;
    let totalSaved = 0;

    for (const g of goals) {
      if (g.isCompleted) {
        completedGoals.push(g);
      } else {
        activeGoals.push(g);
        if (g.targetAmount && g.targetAmount > 0) {
          totalTarget += g.targetAmount;
          totalSaved += Math.min(g.currentAmount, g.targetAmount);
        } else {
          totalSaved += g.currentAmount;
        }
      }
    }

    const totalRemaining = Math.max(0, totalTarget - totalSaved);
    const overallPercentage = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    const summary: GoalsSummary = {
      totalTarget,
      totalSaved,
      totalRemaining,
      overallPercentage,
      activeCount: activeGoals.length,
      completedCount: completedGoals.length,
      currency,
    };

    return {
      activeGoals,
      completedGoals,
      summary,
    };
  }

  /**
   * Contributes funds from a wallet into a savings goal
   */
  async allocateFundsToGoal(params: {
    goalId: string;
    accountId: string;
    walletId?: string;
    amount: number;
    userId: string;
  }): Promise<{ goal: Goal; isReached: boolean }> {
    const goal = await this.goalRepo.findById(params.goalId);
    if (!goal) throw new Error('Goal not found');

    const newAmount = goal.currentAmount + params.amount;
    const isReached = Boolean(goal.targetAmount && newAmount >= goal.targetAmount);

    // 1. Update goal progress
    await this.goalRepo.updateProgress(goal.id, newAmount);
    if (isReached && !goal.isCompleted) {
      await this.goalRepo.markCompleted(goal.id);
    }

    // 2. If a wallet was selected, record the outflow transaction in the ledger
    if (params.walletId) {
      const transferCategory = await this.categoryRepo.ensureTransferCategory(
        params.userId,
        'expense'
      );

      const txInput: TransactionInput = {
        accountId: params.accountId,
        walletId: params.walletId,
        amount: params.amount,
        type: 'expense',
        categoryId: transferCategory.id,
        date: Date.now(),
        description: `Funded Goal: ${goal.name}`,
        vaultType: 'main',
        currency: 'USD',
      };
      await this.txRepo.create(txInput);
    }

    const updated = await this.goalRepo.findById(goal.id);
    return {
      goal: updated!,
      isReached,
    };
  }

  /**
   * Fetches debts summary and list
   */
  async getDebtsData(accountId: string): Promise<{
    borrowedDebts: Debt[];
    lentDebts: Debt[];
    summary: DebtsSummary;
  }> {
    const allDebts = accountId ? await this.debtRepo.findByAccount(accountId) : [];
    const stats = accountId ? await this.debtRepo.getDebtStats(accountId) : null;
    const account = accountId ? await this.accountRepo.findById(accountId) : null;
    const currency = account?.currency || 'USD';

    const borrowedDebts: Debt[] = [];
    const lentDebts: Debt[] = [];

    for (const d of allDebts) {
      if (d.type === 'borrowed') {
        borrowedDebts.push(d);
      } else {
        lentDebts.push(d);
      }
    }

    const totalLent = stats?.totalLent || 0;
    const totalBorrowed = stats?.totalBorrowed || 0;
    const netPosition = totalLent - totalBorrowed;

    const summary: DebtsSummary = {
      totalLentOutstanding: totalLent,
      totalBorrowedOutstanding: totalBorrowed,
      netPosition,
      overdueCount: stats?.overdueCount || 0,
      pendingLentCount: stats?.pendingLentCount || 0,
      pendingBorrowedCount: stats?.pendingBorrowedCount || 0,
      currency,
    };

    return {
      borrowedDebts,
      lentDebts,
      summary,
    };
  }

  /**
   * Records a payment against an active debt and logs corresponding wallet transaction
   */
  async recordDebtPayment(params: {
    debtId: string;
    accountId: string;
    walletId?: string;
    amount: number;
    userId: string;
  }): Promise<Debt> {
    const debt = await this.debtRepo.findById(params.debtId);
    if (!debt) throw new Error('Debt not found');

    // 1. Record payment in debts repository
    await this.debtRepo.recordPayment(debt.id, params.amount);

    // 2. If wallet is specified, log transaction to maintain derived ledger balance
    if (params.walletId) {
      const isBorrowed = debt.type === 'borrowed';
      const txType: 'expense' | 'income' = isBorrowed ? 'expense' : 'income';

      const category = await this.categoryRepo.ensureTransferCategory(
        params.userId,
        txType
      );

      const txInput: TransactionInput = {
        accountId: params.accountId,
        walletId: params.walletId,
        amount: params.amount,
        type: txType,
        categoryId: category.id,
        date: Date.now(),
        description: isBorrowed
          ? `Repaid loan from ${debt.personName}`
          : `Received debt repayment from ${debt.personName}`,
        vaultType: 'main',
        currency: 'USD',
      };
      await this.txRepo.create(txInput);
    }

    const updated = await this.debtRepo.findById(debt.id);
    return updated!;
  }
}
