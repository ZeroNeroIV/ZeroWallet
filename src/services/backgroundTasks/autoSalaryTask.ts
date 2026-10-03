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
 * Purpose: Parse 24h "HH:MM" string into hours and minutes
 */
export function parsePayTime(payTime?: string): { hours: number; minutes: number } {
  if (!payTime) return { hours: 9, minutes: 0 };
  const match = /^(\d{1,2}):(\d{2})$/.exec(payTime.trim());
  if (!match) return { hours: 9, minutes: 0 };
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return {
    hours: hours >= 0 && hours <= 23 ? hours : 9,
    minutes: minutes >= 0 && minutes <= 59 ? minutes : 0,
  };
}

/**
 * Purpose: Validate 24h "HH:MM" string
 */
export function isValidTime(value?: string): boolean {
  if (!value) return false;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Purpose: Normalize "H:MM" or "HH:MM" to standard 2-digit 24h format "HH:MM"
 */
export function formatTo24H(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return '09:00';
  const hours = Number(match[1]).toString().padStart(2, '0');
  const minutes = Number(match[2]).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Purpose: Format 24h "HH:MM" string for human display (e.g. "3:00 PM")
 */
export function formatPayTimeDisplay(payTime: string = '09:00'): string {
  const { hours, minutes } = parsePayTime(payTime);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${displayHours}:${displayMinutes} ${period}`;
}

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

function payDateForMonth(
  year: number,
  month: number,
  payDay: number,
  hours: number = 9,
  minutes: number = 0
): Date {
  return new Date(year, month, clampPayDay(year, month, payDay), hours, minutes, 0, 0);
}

/**
 * Purpose: Calculate the next payday on or after a given date and time
 *
 * Inputs:
 *   - fromDate (Date): Starting date for calculation
 *   - payDay (number): Day of month salary arrives (1-31)
 *   - payTime (string): Time of day salary arrives (24h "HH:MM", default "09:00")
 *
 * Outputs:
 *   - Returns (Date): Next payday with exact arrival time
 *
 * Side effects: None
 */
export function getNextPayDate(
  fromDate: Date = new Date(),
  payDay: number = 1,
  payTime: string = '09:00'
): Date {
  const { hours, minutes } = parsePayTime(payTime);
  const currentMonthPayDate = payDateForMonth(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    payDay,
    hours,
    minutes
  );

  // If this month's payday is strictly in the future, return it
  if (currentMonthPayDate.getTime() > fromDate.getTime()) {
    return currentMonthPayDate;
  }

  // Otherwise, the payday is in the next month
  const nextMonth = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 1);
  return payDateForMonth(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    payDay,
    hours,
    minutes
  );
}

function getNextFirstOfMonth(fromDate: Date = new Date()): number {
  const nextMonth = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth() + 1,
    1,
    9, 0, 0, 0 // Start of day 9:00 AM default
  );
  return nextMonth.getTime();
}

/**
 * Purpose: Advance a payday by one month, keeping the same pay day and time
 * (clamped to shorter months, e.g. 31st → Feb 28th)
 */
export function advanceOneMonth(
  payday: Date,
  payDay: number,
  payTime: string = '09:00'
): Date {
  const { hours, minutes } = parsePayTime(payTime);
  const next = new Date(payday.getFullYear(), payday.getMonth() + 1, 1);
  return payDateForMonth(next.getFullYear(), next.getMonth(), payDay, hours, minutes);
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
let salaryRunInFlight: Promise<{ processed: boolean; count: number; totalAmount: number }> | null = null;

export async function checkAndProcessAutoSalary(): Promise<{ processed: boolean; count: number; totalAmount: number }> {
  if (salaryRunInFlight) {
    // Another caller is already processing; wait for it and report nothing new
    await salaryRunInFlight.catch(() => undefined);
    return { processed: false, count: 0, totalAmount: 0 };
  }
  salaryRunInFlight = processAutoSalary();
  try {
    return await salaryRunInFlight;
  } finally {
    salaryRunInFlight = null;
  }
}

async function processAutoSalary(): Promise<{ processed: boolean; count: number; totalAmount: number }> {
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

  // Guard against a target wallet that no longer exists (deleted):
  // fall back to the main wallet so salary is never lost
  try {
    const { WalletRepository } = await import('../../database/repositories/WalletRepository');
    const target = await new WalletRepository().findById(salarySettings.targetVault, currentAccountId);
    if (!target) {
      console.warn('[AutoSalaryTask] Target wallet missing, falling back to main');
      settingsStore.updateSalarySettings({ targetVault: 'main' });
      salarySettings.targetVault = 'main';
    }
  } catch (error) {
    console.error('[AutoSalaryTask] Wallet check failed:', error);
    return { processed: false, count: 0, totalAmount: 0 };
  }

  // Get next payment date (migrate legacy 1st-of-month schedules to payday)
  const payDay = salarySettings.payDay ?? 1;
  const payTime = salarySettings.payTime || '09:00';
  const nextPaymentDate = salarySettings.nextProcessing || getNextPayDate(new Date(), payDay, payTime).getTime();
  const now = new Date();

  // Collect every payday on or before now (catches up missed months, does not trigger before estimated time)
  const dueDates: Date[] = [];
  let cursor = new Date(nextPaymentDate);
  let guard = 0;
  while (cursor <= now && guard < 120) {
    dueDates.push(new Date(cursor));
    cursor = advanceOneMonth(cursor, payDay, payTime);
    guard += 1;
  }

  if (dueDates.length === 0) {
    console.log('[AutoSalaryTask] No salary due yet. Next payment:', new Date(nextPaymentDate).toString());
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
    let createdCount = 0;

    // Process each due payday
    for (const payDate of dueDates) {
      const monthName = payDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      // Idempotency: never pay the same month twice (concurrent runs, restored
      // backups, or a reset schedule would otherwise duplicate the salary)
      const alreadyPaid = await transactionRepo.existsAutoSalaryForMonth(
        currentAccountId,
        payDate,
      );
      if (alreadyPaid) {
        console.log(`[AutoSalaryTask] Salary for ${monthName} already recorded, skipping`);
        continue;
      }

      console.log(`[AutoSalaryTask] Adding salary for ${monthName}...`);

      // Create income transaction dated on the payday with exact pay time
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
      createdCount += 1;
    }

    if (createdCount > 0) {
      const currentBalance = accountStore.balances[currentAccountId];
      if (currentBalance) {
        const vt = VaultType.parse(salarySettings.targetVault);
        accountStore.updateBalance(currentAccountId, vt.adjustBalance(currentBalance, totalAmountAdded));
      }
    }

    // Next payment is the payday after the last one processed
    const newNextPayment = advanceOneMonth(dueDates[dueDates.length - 1], payDay, payTime).getTime();

    // Update settings
    settingsStore.updateSalarySettings({
      lastProcessed: Date.now(),
      nextProcessing: newNextPayment,
    });

    console.log(`[AutoSalaryTask] Processed ${createdCount}/${dueDates.length} month(s), total: ${totalAmountAdded}`);
    console.log(`[AutoSalaryTask] Next payment scheduled: ${new Date(newNextPayment).toString()}`);

    return { processed: createdCount > 0, count: createdCount, totalAmount: totalAmountAdded };
  } catch (error) {
    console.error('[AutoSalaryTask] Failed to process salary:', error);
    return { processed: false, count: 0, totalAmount: 0 };
  }
}

/**
 * Purpose: Initialize auto-salary schedule when user enables it
 * 
 * Inputs:
 *   - payDay (number): Day of month (1-31)
 *   - payTime (string): 24h format "HH:MM" (default "09:00")
 * 
 * Outputs:
 *   - Returns (number): Next payment date timestamp
 * 
 * Side effects:
 *   - Updates nextProcessing in settings
 */
export function initializeAutoSalarySchedule(payDay: number = 1, payTime: string = '09:00'): number {
  const now = new Date();
  const nextPayment = getNextPayDate(now, payDay, payTime).getTime();

  console.log(`[AutoSalaryTask] Auto-salary initialized. Next payment: ${new Date(nextPayment).toString()}`);

  return nextPayment;
}

/**
 * Purpose: Get formatted text showing next salary processing date & estimated time
 * 
 * Inputs:
 *   - nextProcessing (number): Unix timestamp of next processing
 * 
 * Outputs:
 *   - Returns (string): Formatted date & time string (e.g., "March 3, 2026 at 3:00 PM")
 * 
 * Side effects: None
 */
export function getNextSalaryDate(nextProcessing: number): string {
  const date = new Date(nextProcessing);
  const datePart = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} at ${timePart}`;
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
  const payTime = salarySettings.payTime || '09:00';

  const nextPayment = salarySettings.nextProcessing || getNextPayDate(new Date(), payDay, payTime).getTime();
  let monthsPending = 0;
  if (salarySettings.isEnabled) {
    let cursor = new Date(nextPayment);
    const now = new Date();
    let guard = 0;
    while (cursor <= now && guard < 120) {
      monthsPending += 1;
      cursor = advanceOneMonth(cursor, payDay, payTime);
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
