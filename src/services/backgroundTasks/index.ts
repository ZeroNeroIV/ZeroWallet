/**
 * Purpose: Central coordinator for all background tasks and automated processes
 * 
 * Inputs:
 *   - None (background task coordinator)
 * 
 * Outputs:
 *   - Returns (Promise<void>): Completes when all tasks finish
 * 
 * Side effects:
 *   - Processes subscriptions, recurring expenses, and salary
 *   - Sends notifications for processed items
 *   - Checks for low balance warnings
 *   - Logs processing results
 */

import { checkAndProcessSubscriptions } from './subscriptionTask';
import { checkAndProcessRecurringExpenses } from './recurringExpenseTask';
import { checkAndProcessAutoSalary } from './autoSalaryTask';
import { checkAndCompleteGoals } from './goalTask';
import { useSettingsStore } from '../../store/settingsStore';
import {
  showSalaryNotification,
  showSubscriptionNotification,
  showRecurringExpenseNotification,
  showLowBalanceWarning,
  checkNotificationPermission,
} from '../notifications/notificationService';
import { useAccountStore } from '../../store/accountStore';
import { useAuthStore } from '../../store/authStore';

// ============================================
// Run All Background Tasks
// ============================================

/**
 * Purpose: Execute all automated background tasks in sequence
 * 
 * Inputs: None
 * 
 * Outputs:
 *   - Returns (Promise<void>): Completes when all tasks finish
 * 
 * Side effects:
 *   - Processes all due automated transactions
 *   - Sends notifications for each processed item
 *   - Updates vault balances
 */
export async function runAllBackgroundTasks(accountId: string): Promise<void> {
  console.log('[BackgroundTasks] Starting all background tasks...');

  try {
    // Check notification permission
    const hasNotificationPermission = await checkNotificationPermission();

    // 1. Process auto-salary (1st of month)
    const salaryResult = await checkAndProcessAutoSalary();
    if (salaryResult.processed && hasNotificationPermission) {
      const settingsStore = useSettingsStore.getState();
      const { salarySettings } = settingsStore;
      await showSalaryNotification(
        salarySettings.amount,
        salarySettings.targetVault
      );
    }

    // 2. Process subscriptions (daily billing day check)
    const subscriptionResults = await checkAndProcessSubscriptions(accountId);
    if (hasNotificationPermission && subscriptionResults.processed > 0) {
      console.log(`[BackgroundTasks] ${subscriptionResults.processed} subscriptions processed`);
    }

    // 3. Process recurring expenses (based on frequency)
    const recurringResults = await checkAndProcessRecurringExpenses(accountId);
    if (hasNotificationPermission && recurringResults.processed > 0) {
      console.log(`[BackgroundTasks] ${recurringResults.processed} recurring expenses processed`);
    }

    // 4. Check goal completions
    await checkAndCompleteGoals(accountId);

    // 5. Check for low balance warnings
    await checkLowBalanceWarnings();

    console.log('[BackgroundTasks] All tasks completed successfully');
  } catch (error) {
    console.error('[BackgroundTasks] Error running background tasks:', error);
  }
}

// ============================================
// Run Missed Tasks (on app launch)
// ============================================

/**
 * Purpose: Process any missed automated tasks since last app session
 * 
 * Inputs: None
 * 
 * Outputs:
 *   - Returns (Promise<void>): Completes when catch-up is done
 * 
 * Side effects:
 *   - Processes missed salary, subscriptions, and recurring expenses
 *   - Sends notifications for missed items
 *   - Updates vault balances
 */
export async function runMissedTasks(accountId: string): Promise<void> {
  console.log('[BackgroundTasks] Checking for missed tasks...');

  try {
    // All missed tasks are now handled by the new check functions
    // They automatically detect and process multiple missed periods
    
    // 1. Check for missed salary (if past 1st of month)
    await checkAndProcessAutoSalary();

    // 2. Check for missed subscriptions
    await checkAndProcessSubscriptions(accountId);

    // 3. Check for missed recurring expenses
    await checkAndProcessRecurringExpenses(accountId);

    // 4. Check goal completions
    await checkAndCompleteGoals(accountId);

    // 5. Check low balance warnings
    await checkLowBalanceWarnings();

    console.log('[BackgroundTasks] Missed tasks check completed');
  } catch (error) {
    console.error('[BackgroundTasks] Error checking missed tasks:', error);
  }
}

// ============================================
// Check Low Balance Warnings
// ============================================

/**
 * Purpose: Check all vaults for low balance and send warnings
 * 
 * Inputs: None
 * 
 * Outputs:
 *   - Returns (Promise<void>): Completes when check is done
 * 
 * Side effects:
 *   - Sends low balance notifications if balance < $50
 */
async function checkLowBalanceWarnings(): Promise<void> {
  const LOW_BALANCE_THRESHOLD = 50;

  try {
    const accountStore = useAccountStore.getState();
    const { balances } = accountStore;

    // Check each account's vaults
    for (const [accountId, balance] of Object.entries(balances)) {
      // Check main vault
      if (balance.mainBalance < LOW_BALANCE_THRESHOLD && balance.mainBalance > 0) {
        await showLowBalanceWarning('main', balance.mainBalance);
      }

      // Check savings vault
      if (balance.savingsBalance < LOW_BALANCE_THRESHOLD && balance.savingsBalance > 0) {
        await showLowBalanceWarning('savings', balance.savingsBalance);
      }

      // Check held vault
      if (balance.heldBalance < LOW_BALANCE_THRESHOLD && balance.heldBalance > 0) {
        await showLowBalanceWarning('held', balance.heldBalance);
      }
    }
  } catch (error) {
    console.error('[BackgroundTasks] Error checking low balance:', error);
  }
}

// ============================================
// Schedule Periodic Task Runner
// ============================================

/**
 * Purpose: Set up interval to run background tasks periodically
 * 
 * Inputs:
 *   - intervalMinutes (number): How often to run tasks (default: 60 minutes)
 * 
 * Outputs:
 *   - Returns (NodeJS.Timeout): Interval ID for cleanup
 * 
 * Side effects:
 *   - Runs background tasks every X minutes while app is active
 */
export function schedulePeriodicTaskRunner(intervalMinutes: number = 60): NodeJS.Timeout {
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[BackgroundTasks] Scheduling tasks every ${intervalMinutes} minutes`);

  const intervalId = setInterval(() => {
    console.log('[BackgroundTasks] Running periodic task check...');
    const accountId = useAuthStore.getState().currentAccountId;
    if (accountId) {
      runAllBackgroundTasks(accountId);
    }
  }, intervalMs);

  return intervalId;
}

// ============================================
// Stop Periodic Task Runner
// ============================================

/**
 * Purpose: Stop the periodic task runner
 * 
 * Inputs:
 *   - intervalId (NodeJS.Timeout): Interval ID to clear
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Clears the interval timer
 */
export function stopPeriodicTaskRunner(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('[BackgroundTasks] Periodic task runner stopped');
}
