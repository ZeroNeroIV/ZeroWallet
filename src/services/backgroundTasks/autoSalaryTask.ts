/**
 * Purpose: Process automatic monthly salary on the user's payday
 *
 * Strategy:
 *   - When user enables auto-salary, save nextPaymentDate (next payday)
 *   - On every app open, pay every payday on or before today
 *   - If months were missed, process all missed paydays
 *   - Update nextPaymentDate after processing
 *
 * Example (payDay = 25):
 *   - User enables on Feb 4 → nextPaymentDate = Feb 25
 *   - User opens app on March 15 → process Feb 25 salary, set next = Mar 25
 *   - User opens app on June 5 → process Mar/Apr/May/Jun salaries (4 paydays)
 */

import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { VaultType } from '../../domain/vault/VaultType';
import { useSettingsStore } from '../../store/settingsStore';
import { useAccountStore } from '../../store/accountStore';
import { useAuthStore } from '../../store/authStore';

/**
 * Purpose: Days in a given month (for clamping paydays like the 31st)
 *
 * Side effects: None
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampPayDay(year: number, month: number, payDay: number): number {
  return Math.min(Math.max(1, payDay), daysInMonth(year, month));
}

function payDateForMonth(year: number, month: number, payDay: number): Date {
  return new Date(year, month, clampPayDay(year, month, payDay), 0, 0, 0, 0);
}

/**
 * Purpose: Calculate the next payday on or after a given date
 *
 * Inputs:
 *   - fromDate (Date): Starting date for calculation
 *   - payDay (number): Day of month salary arrives (1-31)
 *
 * Outputs:
 *   - Returns (Date): Next payday (start of day)
 *
 * Side effects: None
 */
export function getNextPayDate(fromDate: Date = new Date(), payDay: number = 1): Date {
  const day = clampPayDay(fromDate.getFullYear(), fromDate.getMonth(), payDay);
  if (fromDate.getDate() <= day) {
    return payDateForMonth(fromDate.getFullYear(), fromDate.getMonth(), payDay);
  }
  const next = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 1);
  return payDateForMonth(next.getFullYear(), next.getMonth(), payDay);
}

function getNextFirstOfMonth(fromDate: Date = new Date()): number {
  const nextMonth = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth() + 1,
    1,
    0, 0, 0, 0 // Start of day
  );
  return nextMonth.getTime();
}

/**
 * Purpose: Advance a payday by one month, keeping the same pay day
 * (clamped to shorter months, e.g. 31st → Feb 28th)
 */
function advanceOneMonth(payday: Date, payDay: number): Date {
  const next = new Date(payday.getFullYear(), payday.getMonth() + 1, 1);
  return payDateForMonth(next.getFullYear(), next.getMonth(), payDay);
}

/**
 * Purpose: Process auto-salary on app open - handles single or multiple missed payments
 * 
 * Inputs:
 *   - None
 * 
 * Outputs:
 *   - Returns (Promise<{processed: boolean, count: number, totalAmount: number}>): Result of processing
 * 
 * Side effects:
 *   - Creates income transactions for each missed month
 *   - Updates vault balance
 *   - Updates nextPaymentDate in settings
 */
export async function checkAndProcessAutoSalary(): Promise<{ processed: boolean; count: number; totalAmount: number }> {
  console.log('[AutoSalaryTask] Checking for auto-salary on app open...');

  const settingsStore = useSettingsStore.getState();
  const accountStore = useAccountStore.getState();
  const authStore = useAuthStore.getState();

  const { salarySettings } = settingsStore;
  const { currentAccountId } = authStore;

  // Validation checks
  if (!salarySettings.isEnabled) {
    console.log('[AutoSalaryTask] Auto-salary is disabled');
    return { processed: false, count: 0, totalAmount: 0 };
  }

  if (!salarySettings.amount || salarySettings.amount <= 0) {
    console.log('[AutoSalaryTask] Salary amount not configured');
    return { processed: false, count: 0, totalAmount: 0 };
  }

  if (!salarySettings.categoryId) {
    console.log('[AutoSalaryTask] Salary category not configured');
    return { processed: false, count: 0, totalAmount: 0 };
  }

  if (!currentAccountId) {
    console.log('[AutoSalaryTask] No active account');
    return { processed: false, count: 0, totalAmount: 0 };
  }

  // Get next payment date (migrate legacy 1st-of-month schedules to payday)
  const payDay = salarySettings.payDay ?? 1;
  const nextPaymentDate = salarySettings.nextProcessing || getNextPayDate(new Date(), payDay).getTime();
  const now = new Date();

  // Collect every payday on or before today (catches up missed months)
  const dueDates: Date[] = [];
  let cursor = new Date(nextPaymentDate);
  let guard = 0;
  while (cursor <= now && guard < 120) {
    dueDates.push(new Date(cursor));
    cursor = advanceOneMonth(cursor, payDay);
    guard += 1;
  }

  if (dueDates.length === 0) {
    console.log('[AutoSalaryTask] No salary due yet. Next payment:', new Date(nextPaymentDate).toDateString());
    return { processed: false, count: 0, totalAmount: 0 };
  }

  console.log(`[AutoSalaryTask] Processing ${dueDates.length} month(s) of salary...`);

  try {
    const transactionRepo = new TransactionRepository();
    const accountRepo = new AccountRepository();

    // Get account currency
    const account = await accountRepo.findById(currentAccountId);
    const accountCurrency = account?.currency || 'USD';

    let totalAmountAdded = 0;

    // Process each due payday
    for (const payDate of dueDates) {
      const monthName = payDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      console.log(`[AutoSalaryTask] Adding salary for ${monthName}...`);

      // Create income transaction dated on the payday
      await transactionRepo.create({
        accountId: currentAccountId,
        type: 'income',
        amount: salarySettings.amount,
        categoryId: salarySettings.categoryId,
        vaultType: salarySettings.targetVault,
        description: `Monthly Salary - ${monthName} (Auto)`,
        date: payDate.getTime(),
        currency: accountCurrency,
      });

      totalAmountAdded += salarySettings.amount;
    }

    const currentBalance = accountStore.balances[currentAccountId];
    if (currentBalance) {
      const vt = VaultType.parse(salarySettings.targetVault);
      accountStore.updateBalance(currentAccountId, vt.adjustBalance(currentBalance, totalAmountAdded));
    }

    // Next payment is the payday after the last one processed
    const newNextPayment = advanceOneMonth(dueDates[dueDates.length - 1], payDay).getTime();

    // Update settings
    settingsStore.updateSalarySettings({
      lastProcessed: Date.now(),
      nextProcessing: newNextPayment,
    });

    console.log(`[AutoSalaryTask] Processed ${dueDates.length} month(s), total: ${totalAmountAdded}`);
    console.log(`[AutoSalaryTask] Next payment scheduled: ${new Date(newNextPayment).toDateString()}`);

    return { processed: true, count: dueDates.length, totalAmount: totalAmountAdded };
  } catch (error) {
    console.error('[AutoSalaryTask] Failed to process salary:', error);
    return { processed: false, count: 0, totalAmount: 0 };
  }
}

/**
 * Purpose: Initialize auto-salary schedule when user enables it
 * 
 * Inputs:
 *   - None (reads from settings)
 * 
 * Outputs:
 *   - Returns (number): Next payment date timestamp
 * 
 * Side effects:
 *   - Updates nextProcessing in settings
 */
export function initializeAutoSalarySchedule(payDay: number = 1): number {
  const now = new Date();
  const nextPayment = getNextPayDate(now, payDay).getTime();

  console.log(`[AutoSalaryTask] Auto-salary initialized. Next payment: ${new Date(nextPayment).toDateString()}`);

  return nextPayment;
}

/**
 * Purpose: Get formatted text showing next salary processing date
 * 
 * Inputs:
 *   - nextProcessing (number): Unix timestamp of next processing
 * 
 * Outputs:
 *   - Returns (string): Formatted date string (e.g., "March 1, 2026")
 * 
 * Side effects: None
 */
export function getNextSalaryDate(nextProcessing: number): string {
  const date = new Date(nextProcessing);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Purpose: Get info about pending salary payments (for display)
 * 
 * Inputs:
 *   - None
 * 
 * Outputs:
 *   - Returns object with payment info
 * 
 * Side effects: None
 */
export function getSalaryPaymentInfo(): {
  isEnabled: boolean;
  nextPaymentDate: string;
  amount: number;
  monthsPending: number;
} {
  const { salarySettings } = useSettingsStore.getState();
  const payDay = salarySettings.payDay ?? 1;

  const nextPayment = salarySettings.nextProcessing || getNextPayDate(new Date(), payDay).getTime();
  let monthsPending = 0;
  if (salarySettings.isEnabled) {
    let cursor = new Date(nextPayment);
    const now = new Date();
    let guard = 0;
    while (cursor <= now && guard < 120) {
      monthsPending += 1;
      cursor = advanceOneMonth(cursor, payDay);
      guard += 1;
    }
  }

  return {
    isEnabled: salarySettings.isEnabled,
    nextPaymentDate: getNextSalaryDate(nextPayment),
    amount: salarySettings.amount,
    monthsPending,
  };
}
