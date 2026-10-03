/**
 * HITL (Human-In-The-Loop) Approval Service
 *
 * Coordinates human approval for automated commitments:
 * - Recurring expenses
 * - Subscriptions
 * - Auto-salary deposits
 *
 * Prevents automated background transaction creation without user consent.
 * Allows user to:
 * 1. Accept (create transaction & advance cycle)
 * 2. Cancel for this sprint (skip transaction & advance cycle)
 * 3. Delay with custom input (XX minutes, days, weeks, months, or years)
 */

import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import { VaultType } from '../../domain/vault/VaultType';
import { useSettingsStore } from '../../store/settingsStore';
import { useAccountStore } from '../../store/accountStore';
import { useAuthStore } from '../../store/authStore';
import { useHitlStore } from '../../store/hitlStore';
import { ordinalDay } from '../../utils/wallets';
import { advanceOneMonth, getNextPayDate } from '../backgroundTasks/autoSalaryTask';
import { calculateNextBillingDate } from '../backgroundTasks/subscriptionTask';
import { calculateNextOccurrence } from '../backgroundTasks/recurringExpenseTask';
import type { HitlApprovalItem, DelayUnit } from '../../types/hitl';

/**
 * Purpose: Calculate exact future timestamp given a numeric amount and unit
 */
export function calculateDelayTimestamp(
  value: number,
  unit: DelayUnit,
  fromDate: Date = new Date()
): number {
  const safeValue = Math.max(1, Math.floor(value));
  const d = new Date(fromDate);

  switch (unit) {
    case 'minutes':
      return d.getTime() + safeValue * 60 * 1000;
    case 'days':
      return d.getTime() + safeValue * 24 * 60 * 60 * 1000;
    case 'weeks':
      return d.getTime() + safeValue * 7 * 24 * 60 * 60 * 1000;
    case 'months': {
      const currentDay = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + safeValue);
      const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(currentDay, daysInTargetMonth));
      return d.getTime();
    }
    case 'years': {
      const currentDay = d.getDate();
      d.setDate(1);
      d.setFullYear(d.getFullYear() + safeValue);
      const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(currentDay, daysInTargetMonth));
      return d.getTime();
    }
  }
}

/**
 * Purpose: Format human-friendly preview of delayed time
 */
export function formatDelayPreview(
  value: number,
  unit: DelayUnit,
  fromDate: Date = new Date()
): string {
  const targetTime = calculateDelayTimestamp(value, unit, fromDate);
  const targetDate = new Date(targetTime);

  const datePart = targetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = targetDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${datePart} at ${timePart}`;
}

/**
 * Purpose: Inspect all recurring commitments and return any that are due for HITL review
 */
export async function checkDueItems(accountId: string): Promise<HitlApprovalItem[]> {
  const dueItems: HitlApprovalItem[] = [];
  const now = new Date();

  try {
    const accountRepo = new AccountRepository();
    const walletRepo = new WalletRepository();
    const categoryRepo = new CategoryRepository();
    const transactionRepo = new TransactionRepository();
    const subscriptionRepo = new SubscriptionRepository();
    const recurringRepo = new RecurringExpenseRepository();

    const account = await accountRepo.findById(accountId);
    const accountCurrency = account?.currency || 'USD';

    // Build lookup maps for names
    const wallets = await walletRepo.findByAccount(accountId);
    const walletNameMap: Record<string, string> = {};
    for (const w of wallets) {
      walletNameMap[w.id] = w.name;
    }

    const { currentUser } = useAuthStore.getState();
    const categoryNameMap: Record<string, string> = {};
    if (currentUser) {
      try {
        const categories = await categoryRepo.findByUser(currentUser.id);
        for (const c of categories) {
          categoryNameMap[c.id] = c.name;
        }
      } catch (err) {
        console.warn('[HitlService] Could not load categories:', err);
      }
    }

    // 1. Check Auto-Salary
    const settingsStore = useSettingsStore.getState();
    const { salarySettings } = settingsStore;
    if (
      salarySettings.isEnabled &&
      salarySettings.amount > 0 &&
      salarySettings.categoryId
    ) {
      const payDay = salarySettings.payDay ?? 1;
      const payTime = salarySettings.payTime || '09:00';
      const nextPaymentDate =
        salarySettings.nextProcessing || getNextPayDate(now, payDay, payTime).getTime();

      if (nextPaymentDate <= now.getTime()) {
        const payDate = new Date(nextPaymentDate);
        const alreadyPaid = await transactionRepo.existsAutoSalaryForMonth(accountId, payDate);

        if (!alreadyPaid) {
          const monthName = payDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          const targetWalletId = salarySettings.targetVault || 'main';
          dueItems.push({
            id: `salary_${payDate.getFullYear()}_${payDate.getMonth()}`,
            type: 'salary',
            entityId: 'auto_salary',
            name: 'Monthly Salary',
            amount: salarySettings.amount,
            currency: accountCurrency,
            vaultType: targetWalletId,
            walletName: walletNameMap[targetWalletId] || 'Primary Wallet',
            accountId,
            categoryId: salarySettings.categoryId,
            categoryName: categoryNameMap[salarySettings.categoryId] || 'Salary',
            dueDate: payDate.getTime(),
            dateDescription: monthName,
            frequencyDescription: `Monthly on the ${ordinalDay(payDay)}`,
            originalItem: { ...salarySettings, targetPayDate: payDate.getTime() },
          });
        }
      }
    }

    // 2. Check Subscriptions
    const activeSubscriptions = await subscriptionRepo.findActiveByAccount(accountId);
    for (const sub of activeSubscriptions) {
      if (sub.nextProcessing <= now.getTime()) {
        const billingDate = new Date(sub.nextProcessing);
        const alreadyProcessed = await transactionRepo.existsBySubscriptionAndDate(
          sub.id,
          billingDate.getTime()
        );

        if (!alreadyProcessed) {
          const monthName = billingDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          const targetWalletId = sub.vaultType || 'main';
          dueItems.push({
            id: `subscription_${sub.id}_${billingDate.getFullYear()}_${billingDate.getMonth()}`,
            type: 'subscription',
            entityId: sub.id,
            name: sub.name,
            amount: sub.amount,
            currency: accountCurrency,
            vaultType: targetWalletId,
            walletName: walletNameMap[targetWalletId] || 'Primary Wallet',
            accountId,
            categoryId: sub.categoryId,
            categoryName: categoryNameMap[sub.categoryId] || 'Subscription',
            dueDate: billingDate.getTime(),
            dateDescription: monthName,
            frequencyDescription: `Monthly on the ${ordinalDay(sub.billingDay)}`,
            originalItem: { ...sub, targetBillingDate: billingDate.getTime() },
          });
        }
      }
    }

    // 3. Check Recurring Expenses
    const activeExpenses = await recurringRepo.findActiveByAccount(accountId);
    for (const exp of activeExpenses) {
      if (exp.nextOccurrence <= now.getTime()) {
        const occurrenceDate = new Date(exp.nextOccurrence);
        const alreadyProcessed = await transactionRepo.existsByRecurringExpenseAndDate(
          exp.id,
          occurrenceDate.getTime()
        );

        if (!alreadyProcessed) {
          const dateStr = occurrenceDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const targetWalletId = exp.vaultType || 'main';
          dueItems.push({
            id: `recurring_${exp.id}_${occurrenceDate.getTime()}`,
            type: 'recurring_expense',
            entityId: exp.id,
            name: exp.name,
            amount: exp.amount,
            currency: accountCurrency,
            vaultType: targetWalletId,
            walletName: walletNameMap[targetWalletId] || 'Primary Wallet',
            accountId,
            categoryId: exp.categoryId,
            categoryName: categoryNameMap[exp.categoryId] || 'Recurring',
            dueDate: occurrenceDate.getTime(),
            dateDescription: dateStr,
            frequencyDescription: `${exp.frequency.toUpperCase()} (interval ${exp.interval})`,
            originalItem: { ...exp, targetOccurrenceDate: occurrenceDate.getTime() },
          });
        }
      }
    }
  } catch (error) {
    console.error('[HitlService] Error checking due items:', error);
  }

  return dueItems;
}

/**
 * Purpose: Check for due commitments and prompt user via HITL modal queue
 */
export async function checkAndPromptHitlTasks(accountId: string): Promise<number> {
  console.log('[HitlService] Scanning commitments for HITL approval...');
  const due = await checkDueItems(accountId);
  if (due.length > 0) {
    console.log(`[HitlService] Found ${due.length} due item(s) awaiting approval`);
    useHitlStore.getState().enqueueItems(due);
  } else {
    console.log('[HitlService] No pending commitments due at this time');
  }
  return due.length;
}

/**
 * Action 1: Accept the new transaction
 * Logs transaction in DB, updates vault balance, and advances cycle
 */
export async function acceptHitlItem(item: HitlApprovalItem): Promise<void> {
  const transactionRepo = new TransactionRepository();
  const accountStore = useAccountStore.getState();

  try {
    if (item.type === 'salary') {
      const settingsStore = useSettingsStore.getState();
      const monthName = new Date(item.dueDate).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      await transactionRepo.create({
        accountId: item.accountId,
        type: 'income',
        amount: item.amount,
        categoryId: item.categoryId || settingsStore.salarySettings.categoryId,
        vaultType: item.vaultType as any,
        description: `Monthly Salary - ${monthName} (Auto)`,
        date: item.dueDate,
        currency: item.currency,
      });

      const currentBalance = accountStore.balances[item.accountId];
      if (currentBalance) {
        const vt = VaultType.parse(item.vaultType);
        accountStore.updateBalance(item.accountId, vt.adjustBalance(currentBalance, item.amount));
      }

      const payDay = settingsStore.salarySettings.payDay ?? 1;
      const payTime = settingsStore.salarySettings.payTime || '09:00';
      const nextPayment = advanceOneMonth(new Date(item.dueDate), payDay, payTime).getTime();

      settingsStore.updateSalarySettings({
        lastProcessed: Date.now(),
        nextProcessing: nextPayment,
      });
    } else if (item.type === 'subscription') {
      const subscriptionRepo = new SubscriptionRepository();
      const monthName = new Date(item.dueDate).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      await transactionRepo.create({
        accountId: item.accountId,
        type: 'expense',
        amount: item.amount,
        categoryId: item.categoryId || '',
        vaultType: item.vaultType as any,
        description: `${item.name} - ${monthName} (Auto)`,
        date: item.dueDate,
        currency: item.currency,
        subscriptionId: item.entityId,
      });

      const currentBalance = accountStore.balances[item.accountId];
      if (currentBalance) {
        const vt = VaultType.parse(item.vaultType);
        accountStore.updateBalance(item.accountId, vt.adjustBalance(currentBalance, -item.amount));
      }

      const newNext = calculateNextBillingDate(item.originalItem.billingDay, new Date(item.dueDate));
      await subscriptionRepo.update(item.entityId, {
        lastProcessed: Date.now(),
        nextProcessing: newNext,
      });
    } else if (item.type === 'recurring_expense') {
      const recurringRepo = new RecurringExpenseRepository();
      const dateStr = new Date(item.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      await transactionRepo.create({
        accountId: item.accountId,
        type: 'expense',
        amount: item.amount,
        categoryId: item.categoryId || '',
        vaultType: item.vaultType as any,
        description: `${item.name} - ${dateStr} (Auto)`,
        date: item.dueDate,
        currency: item.currency,
        recurringExpenseId: item.entityId,
      });

      const currentBalance = accountStore.balances[item.accountId];
      if (currentBalance) {
        const vt = VaultType.parse(item.vaultType);
        accountStore.updateBalance(item.accountId, vt.adjustBalance(currentBalance, -item.amount));
      }

      const newNext = calculateNextOccurrence(
        item.originalItem.frequency,
        item.originalItem.interval,
        new Date(item.dueDate)
      );
      await recurringRepo.update(item.entityId, {
        lastProcessed: Date.now(),
        nextOccurrence: newNext,
      });
    }

    useHitlStore.getState().removeCurrentItem();
  } catch (error) {
    console.error(`[HitlService] Error accepting item ${item.name}:`, error);
    throw error;
  }
}

/**
 * Action 2: Cancel transaction for this sprint/time
 * Does NOT log transaction, skips funding movement, and advances cycle
 */
export async function cancelHitlItem(item: HitlApprovalItem): Promise<void> {
  try {
    if (item.type === 'salary') {
      const settingsStore = useSettingsStore.getState();
      const payDay = settingsStore.salarySettings.payDay ?? 1;
      const payTime = settingsStore.salarySettings.payTime || '09:00';
      const nextPayment = advanceOneMonth(new Date(item.dueDate), payDay, payTime).getTime();

      settingsStore.updateSalarySettings({
        nextProcessing: nextPayment,
      });
    } else if (item.type === 'subscription') {
      const subscriptionRepo = new SubscriptionRepository();
      const newNext = calculateNextBillingDate(item.originalItem.billingDay, new Date(item.dueDate));
      await subscriptionRepo.update(item.entityId, {
        nextProcessing: newNext,
      });
    } else if (item.type === 'recurring_expense') {
      const recurringRepo = new RecurringExpenseRepository();
      const newNext = calculateNextOccurrence(
        item.originalItem.frequency,
        item.originalItem.interval,
        new Date(item.dueDate)
      );
      await recurringRepo.update(item.entityId, {
        nextOccurrence: newNext,
      });
    }

    useHitlStore.getState().removeCurrentItem();
  } catch (error) {
    console.error(`[HitlService] Error canceling item ${item.name}:`, error);
    throw error;
  }
}

/**
 * Action 3: Delay transaction with custom input (XX minutes, days, weeks, months, or years)
 * Postpones next trigger to now + custom duration
 */
export async function delayHitlItem(
  item: HitlApprovalItem,
  value: number,
  unit: DelayUnit
): Promise<void> {
  const newTargetDate = calculateDelayTimestamp(value, unit, new Date());

  try {
    if (item.type === 'salary') {
      useSettingsStore.getState().updateSalarySettings({
        nextProcessing: newTargetDate,
      });
    } else if (item.type === 'subscription') {
      await new SubscriptionRepository().update(item.entityId, {
        nextProcessing: newTargetDate,
      });
    } else if (item.type === 'recurring_expense') {
      await new RecurringExpenseRepository().update(item.entityId, {
        nextOccurrence: newTargetDate,
      });
    }

    useHitlStore.getState().removeCurrentItem();
  } catch (error) {
    console.error(`[HitlService] Error delaying item ${item.name}:`, error);
    throw error;
  }
}
