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
import { getWalletBalance } from '../../utils/wallets';
import { WalletRepository } from '../../database/repositories/WalletRepository';

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

    // 1. Scan and prompt user for any due recurring commitments (HITL approval)
    const { checkAndPromptHitlTasks } = await import('../hitl/hitlService');
    await checkAndPromptHitlTasks(accountId);

    // 2. Check goal completions
    await checkAndCompleteGoals(accountId);

    // 3. Check for low balance warnings
    await checkLowBalanceWarnings();

    // 4. Refresh due-date + salary reminders from Smart Nudges settings
    const { scheduleDueReminders, scheduleSalaryReminder } = await import('../notifications/scheduleNudges');
    await scheduleDueReminders(accountId);
    await scheduleSalaryReminder();

    // 5. Check and run scheduled Google Drive backup if due
    const { checkAndProcessGoogleDriveBackup } = await import('./googleDriveBackupTask');
    await checkAndProcessGoogleDriveBackup(accountId);

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
 *   - Detects missed salary, subscriptions, and recurring expenses and queues them for HITL approval
 *   - Checks goal completions & low balance warnings
 */
export async function runMissedTasks(accountId: string): Promise<void> {
  console.log('[BackgroundTasks] Checking for missed tasks...');

  try {
    // 1. Check for missed commitments and queue for HITL approval
    const { checkAndPromptHitlTasks } = await import('../hitl/hitlService');
    await checkAndPromptHitlTasks(accountId);

    // 2. Check goal completions
    await checkAndCompleteGoals(accountId);

    // 3. Check low balance warnings
    await checkLowBalanceWarnings();

    // 4. Refresh due-date + salary reminders from Smart Nudges settings
    const { scheduleDueReminders, scheduleSalaryReminder } = await import('../notifications/scheduleNudges');
    await scheduleDueReminders(accountId);
    await scheduleSalaryReminder();

    // 5. Check missed Google Drive backup
    const { checkAndProcessGoogleDriveBackup } = await import('./googleDriveBackupTask');
    await checkAndProcessGoogleDriveBackup(accountId);

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
 *   - Sends low balance notifications below the configured threshold
 *   - Throttled to one alert per wallet per 24 hours
 */
const LOW_BALANCE_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function checkLowBalanceWarnings(): Promise<void> {
  try {
    const settingsStore = useSettingsStore.getState();
    const { notificationSettings } = settingsStore;
    if (!notificationSettings.lowBalanceAlertEnabled) {
      return;
    }
    const threshold = notificationSettings.lowBalanceThreshold;
    const lastAlert = notificationSettings.lowBalanceLastAlert ?? {};
    const now = Date.now();
    let stamped = false;
    const updated = { ...lastAlert };

    const accountStore = useAccountStore.getState();
    const { balances } = accountStore;

    // Check each account's wallets (throttled: at most one alert per wallet per day)
    const walletRepo = new WalletRepository();
    for (const [accountId, balance] of Object.entries(balances)) {
      let wallets;
      try {
        wallets = await walletRepo.findByAccount(accountId);
      } catch {
        continue;
      }
      if (wallets.length === 0) continue;
      for (const wallet of wallets) {
        const value = getWalletBalance(
          balance as unknown as Record<string, number | undefined>,
          wallet.id
        );
        if (value < threshold && value > 0) {
          const stampKey = `${accountId}:${wallet.id}`;
          if (now - (updated[stampKey] ?? 0) < LOW_BALANCE_ALERT_COOLDOWN_MS) {
            continue;
          }
          await showLowBalanceWarning(wallet.name, value);
          updated[stampKey] = now;
          stamped = true;
        }
      }
    }

    if (stamped) {
      settingsStore.updateNotificationSettings({ lowBalanceLastAlert: updated });
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
