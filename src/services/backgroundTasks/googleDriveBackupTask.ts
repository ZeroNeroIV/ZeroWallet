/**
 * Purpose: Automated Google Drive Backup Task
 *
 * Inputs:
 *   - accountId (string): Active user account ID
 *
 * Outputs:
 *   - Returns (Promise<boolean>): True if backup was executed, false otherwise
 *
 * Side effects:
 *   - Performs automated cloud backup to Google Drive
 *   - Enforces retention policies
 *   - Updates settings store timestamps and status
 *   - Sends local notification if enabled
 */

import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { performGoogleDriveBackup } from '../dataTransfer/googleDriveService';
import { showBackupNotification } from '../notifications/notificationService';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

/**
 * Checks whether an automated cloud backup is currently due based on
 * the user's configured frequency, scheduled time of day, and last backup timestamp.
 */
export function isBackupDue(
  frequency: 'daily' | 'weekly' | 'monthly' | 'manual',
  lastBackupTime: number | null,
  backupTime: string = '02:00'
): boolean {
  if (frequency === 'manual') return false;

  const now = Date.now();
  if (!lastBackupTime || lastBackupTime === 0) {
    return true;
  }

  const elapsed = now - lastBackupTime;

  if (frequency === 'weekly') {
    return elapsed >= ONE_WEEK_MS;
  }

  if (frequency === 'monthly') {
    return elapsed >= ONE_MONTH_MS;
  }

  // Daily frequency: check elapsed time OR check if today's scheduled hour has passed
  if (frequency === 'daily') {
    if (elapsed >= ONE_DAY_MS) {
      return true;
    }

    // Check if the scheduled time of day has arrived today and last backup was on a previous day
    const [schedHours, schedMins] = backupTime.split(':').map(Number);
    const targetToday = new Date();
    targetToday.setHours(schedHours || 2, schedMins || 0, 0, 0);

    const lastDate = new Date(lastBackupTime);
    const isDifferentDay = lastDate.toDateString() !== targetToday.toDateString();

    if (isDifferentDay && now >= targetToday.getTime()) {
      return true;
    }
  }

  return false;
}

/**
 * Checks and executes automated cloud backup if due.
 */
export async function checkAndProcessGoogleDriveBackup(accountId: string): Promise<boolean> {
  const store = useSettingsStore.getState();
  const { googleDriveSettings } = store;

  // Verify requirements
  if (!googleDriveSettings.isEnabled) return false;
  if (!googleDriveSettings.isConnected) return false;
  if (!googleDriveSettings.accessToken) return false;
  if (googleDriveSettings.frequency === 'manual') return false;

  const due = isBackupDue(
    googleDriveSettings.frequency,
    googleDriveSettings.lastBackupTime,
    googleDriveSettings.backupTime
  );

  if (!due) {
    return false;
  }

  const currentUser = useAuthStore.getState().currentUser;
  if (!currentUser) return false;

  console.log('[GoogleDriveBackupTask] Scheduled cloud backup is due. Starting backup process...');

  try {
    const result = await performGoogleDriveBackup(accountId, currentUser.id);
    console.log('[GoogleDriveBackupTask] Backup completed successfully:', result.fileName);

    if (googleDriveSettings.notifyOnBackup) {
      const sizeKb = (result.size / 1024).toFixed(1);
      await showBackupNotification(
        'success',
        `Automated backup completed (${sizeKb} KB) to Google Drive.`
      );
    }

    return true;
  } catch (error: any) {
    console.error('[GoogleDriveBackupTask] Scheduled backup failed:', error);

    store.updateGoogleDriveSettings({
      lastBackupStatus: 'failed',
      lastBackupError: error?.message || 'Automatic backup failed',
    });

    if (googleDriveSettings.notifyOnBackup) {
      await showBackupNotification(
        'failed',
        error?.message || 'Scheduled Google Drive backup could not be completed.'
      );
    }

    return false;
  }
}
