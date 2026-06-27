/**
 * Purpose: Process automatic monthly salary based on scheduled payment dates
 * 
 * Strategy:
 *   - When user enables auto-salary, save nextPaymentDate (1st of next month)
 *   - On every app open, check if current date >= nextPaymentDate
 *   - If missed multiple months, process all missed salaries
 *   - Update nextPaymentDate after processing
 * 
 * Example:
 *   - User enables on Feb 4 → nextPaymentDate = March 1
 *   - User opens app on March 15 → process March salary, set next = April 1
 *   - User opens app on June 5 → process April, May, June salaries (3 months)
 */

import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { VaultType } from '../../domain/vault/VaultType';
import { useSettingsStore } from '../../store/settingsStore';
import { useAccountStore } from '../../store/accountStore';
import { useAuthStore } from '../../store/authStore';

/**
 * Purpose: Calculate the 1st of next month from a given date
 * 
 * Inputs:
 *   - fromDate (Date): Starting date for calculation
 * 
 * Outputs:
 *   - Returns (number): Unix timestamp of next 1st of month
 * 
 * Side effects: None
 */
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
 * Purpose: Calculate how many months of salary need to be paid
 * 
 * Inputs:
 *   - nextPaymentDate (number): Unix timestamp of next scheduled payment
 *   - currentDate (Date): Current date
 * 
 * Outputs:
 *   - Returns (number): Number of months to pay (0 if not due yet)
 * 
 * Side effects: None
 */
function calculateMonthsToPay(nextPaymentDate: number, currentDate: Date = new Date()): number {
  const paymentDate = new Date(nextPaymentDate);
  
  // If current date is before payment date, nothing to pay
  if (currentDate < paymentDate) {
    return 0;
  }
  
  // Calculate months difference
  const paymentYear = paymentDate.getFullYear();
  const paymentMonth = paymentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Total months from payment date to current date (inclusive of current month)
  const monthsDiff = (currentYear - paymentYear) * 12 + (currentMonth - paymentMonth) + 1;
  
  return Math.max(0, monthsDiff);
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

  // Get next payment date
  const nextPaymentDate = salarySettings.nextProcessing || getNextFirstOfMonth();
  const now = new Date();

  // Calculate how many months to pay
  const monthsToPay = calculateMonthsToPay(nextPaymentDate, now);

  if (monthsToPay === 0) {
    console.log('[AutoSalaryTask] No salary due yet. Next payment:', new Date(nextPaymentDate).toDateString());
    return { processed: false, count: 0, totalAmount: 0 };
  }

  console.log(`[AutoSalaryTask] Processing ${monthsToPay} month(s) of salary...`);

  try {
    const transactionRepo = new TransactionRepository();
    const accountRepo = new AccountRepository();
    
    // Get account currency
    const account = await accountRepo.findById(currentAccountId);
    const accountCurrency = account?.currency || 'USD';
    
    const paymentStartDate = new Date(nextPaymentDate);
    let totalAmountAdded = 0;

    // Process each missed month
    for (let i = 0; i < monthsToPay; i++) {
      const paymentMonth = new Date(
        paymentStartDate.getFullYear(),
        paymentStartDate.getMonth() + i,
        1
      );

      const monthName = paymentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      console.log(`[AutoSalaryTask] Adding salary for ${monthName}...`);

      // Create income transaction with the 1st of that month as the date
      await transactionRepo.create({
        accountId: currentAccountId,
        type: 'income',
        amount: salarySettings.amount,
        categoryId: salarySettings.categoryId,
        vaultType: salarySettings.targetVault,
        description: `Monthly Salary - ${monthName} (Auto)`,
        date: paymentMonth.getTime(),
        currency: accountCurrency,
      });

      totalAmountAdded += salarySettings.amount;
    }

    const currentBalance = accountStore.balances[currentAccountId];
    if (currentBalance) {
      const vt = VaultType.parse(salarySettings.targetVault);
      accountStore.updateBalance(currentAccountId, vt.adjustBalance(currentBalance, totalAmountAdded));
    }

    // Calculate next payment date (1st of next month from current date)
    const newNextPayment = getNextFirstOfMonth(now);

    // Update settings
    settingsStore.updateSalarySettings({
      lastProcessed: Date.now(),
      nextProcessing: newNextPayment,
    });

    console.log(`[AutoSalaryTask] Processed ${monthsToPay} month(s), total: ${totalAmountAdded}`);
    console.log(`[AutoSalaryTask] Next payment scheduled: ${new Date(newNextPayment).toDateString()}`);

    return { processed: true, count: monthsToPay, totalAmount: totalAmountAdded };
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
export function initializeAutoSalarySchedule(): number {
  const now = new Date();
  const nextPayment = getNextFirstOfMonth(now);
  
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
  
  const nextPayment = salarySettings.nextProcessing || getNextFirstOfMonth();
  const monthsPending = salarySettings.isEnabled 
    ? calculateMonthsToPay(nextPayment, new Date())
    : 0;

  return {
    isEnabled: salarySettings.isEnabled,
    nextPaymentDate: getNextSalaryDate(nextPayment),
    amount: salarySettings.amount,
    monthsPending,
  };
}
