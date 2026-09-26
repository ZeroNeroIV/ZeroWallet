/**
 * Purpose: Centralized notification service using Notifee for local notifications
 * 
 * Inputs:
 *   - Various notification parameters depending on type
 * 
 * Outputs:
 *   - Returns (Promise<void | string>): Notification ID when created
 * 
 * Side effects:
 *   - Creates notification channels (Android)
 *   - Displays local notifications
 *   - Requests notification permissions
 */

import notifee, { AuthorizationStatus, AndroidImportance } from '@notifee/react-native';
/**
 * Purpose: Show a low-balance warning for a wallet (display name resolved
 * by the caller so custom wallets read correctly too)
 */

// ============================================
// Channel IDs (Android)
// ============================================

export const CHANNEL_IDS = {
  GENERAL: 'wallet-general',
  REMINDERS: 'wallet-reminders',
  TRANSACTIONS: 'wallet-transactions',
  ALERTS: 'wallet-alerts',
};

// ============================================
// Initialize Notification Channels
// ============================================

/**
 * Purpose: Create notification channels for Android
 * 
 * Inputs: None
 * 
 * Outputs:
 *   - Returns (Promise<void>): Completes when channels are created
 * 
 * Side effects:
 *   - Creates 4 notification channels on Android
 */
export async function initializeNotificationChannels(): Promise<void> {
  try {
    // General channel for miscellaneous notifications
    await notifee.createChannel({
      id: CHANNEL_IDS.GENERAL,
      name: 'General',
      description: 'General wallet notifications',
      importance: AndroidImportance.DEFAULT,
    });

    // Reminders channel for nudges and scheduled reminders
    await notifee.createChannel({
      id: CHANNEL_IDS.REMINDERS,
      name: 'Reminders',
      description: 'Daily reminders and nudges',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    // Transactions channel for income/expense notifications
    await notifee.createChannel({
      id: CHANNEL_IDS.TRANSACTIONS,
      name: 'Transactions',
      description: 'Subscription and recurring expense notifications',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    // Alerts channel for important warnings
    await notifee.createChannel({
      id: CHANNEL_IDS.ALERTS,
      name: 'Alerts',
      description: 'Important alerts and warnings',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });

    console.log('[NotificationService] Channels initialized');
  } catch (error) {
    console.error('[NotificationService] Failed to initialize channels:', error);
  }
}

// ============================================
// Request Notification Permission
// ============================================

/**
 * Purpose: Request notification permission from user
 * 
 * Inputs: None
 * 
 * Outputs:
 *   - Returns (Promise<boolean>): true if permission granted
 * 
 * Side effects:
 *   - Shows permission dialog to user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();

    if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
      console.log('[NotificationService] Permission granted');
      return true;
    } else {
      console.log('[NotificationService] Permission denied');
      return false;
    }
  } catch (error) {
    console.error('[NotificationService] Failed to request permission:', error);
    return false;
  }
}

// ============================================
// Check Notification Permission
// ============================================

/**
 * Purpose: Check if notification permission is granted
 * 
 * Inputs: None
 * 
 * Outputs:
 *   - Returns (Promise<boolean>): true if permission granted
 * 
 * Side effects: None
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const settings = await notifee.getNotificationSettings();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch (error) {
    console.error('[NotificationService] Failed to check permission:', error);
    return false;
  }
}

// ============================================
// Show Smart Nudge Notification
// ============================================

/**
 * Purpose: Display daily reminder nudge notification
 * 
 * Inputs:
 *   - message (string): Nudge message to display
 * 
 * Outputs:
 *   - Returns (Promise<string | void>): Notification ID
 * 
 * Side effects:
 *   - Displays notification with reminder icon
 */
export async function showNudgeNotification(message: string): Promise<string | void> {
  try {
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) {
      console.log('[NotificationService] No permission for nudge notification');
      return;
    }

    return await notifee.displayNotification({
      title: '💡 Daily Reminder',
      body: message,
      android: {
        channelId: CHANNEL_IDS.REMINDERS,
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        sound: 'default',
      },
    });
  } catch (error) {
    console.error('[NotificationService] Failed to show nudge:', error);
  }
}

// ============================================
// Show Salary Notification
// ============================================

/**
 * Purpose: Notify user that salary was automatically added
 *
 * Inputs:
 *   - amount (number): Salary amount added
 *   - walletName (string): Display name of the destination wallet
 *
 * Outputs:
 *   - Returns (Promise<string | void>): Notification ID
 *
 * Side effects:
 *   - Displays notification with success icon
 */
export async function showSalaryNotification(
  amount: number,
  walletName: string
): Promise<string | void> {
  try {
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return;

    return await notifee.displayNotification({
      title: '💰 Salary Added',
      body: `$${amount.toFixed(3)} has been added to your ${walletName}`,
      android: {
        channelId: CHANNEL_IDS.TRANSACTIONS,
        color: '#06D6A0',
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        sound: 'default',
      },
    });
  } catch (error) {
    console.error('[NotificationService] Failed to show salary notification:', error);
  }
}

// ============================================
// Show Subscription Notification
// ============================================

/**
 * Purpose: Notify user that subscription was charged
 * 
 * Inputs:
 *   - name (string): Subscription name
 *   - amount (number): Amount charged
 * 
 * Outputs:
 *   - Returns (Promise<string | void>): Notification ID
 * 
 * Side effects:
 *   - Displays notification with warning icon
 */
export async function showSubscriptionNotification(
  name: string,
  amount: number
): Promise<string | void> {
  try {
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return;

    return await notifee.displayNotification({
      title: '🔄 Subscription Charged',
      body: `${name} - $${amount.toFixed(3)} charged from your account`,
      android: {
        channelId: CHANNEL_IDS.TRANSACTIONS,
        color: '#FFD166',
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        sound: 'default',
      },
    });
  } catch (error) {
    console.error('[NotificationService] Failed to show subscription notification:', error);
  }
}

// ============================================
// Show Recurring Expense Notification
// ============================================

/**
 * Purpose: Notify user that recurring expense was processed
 * 
 * Inputs:
 *   - name (string): Recurring expense name
 *   - amount (number): Amount deducted
 * 
 * Outputs:
 *   - Returns (Promise<string | void>): Notification ID
 * 
 * Side effects:
 *   - Displays notification
 */
export async function showRecurringExpenseNotification(
  name: string,
  amount: number
): Promise<string | void> {
  try {
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return;

    return await notifee.displayNotification({
      title: '⏰ Recurring Expense',
      body: `${name} - $${amount.toFixed(3)} deducted automatically`,
      android: {
        channelId: CHANNEL_IDS.TRANSACTIONS,
        color: '#FF8B94',
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        sound: 'default',
      },
    });
  } catch (error) {
    console.error('[NotificationService] Failed to show recurring expense notification:', error);
  }
}

// ============================================
// Show Low Balance Warning
// ============================================

/**
 * Purpose: Warn user about low balance in a wallet
 *
 * Inputs:
 *   - walletName (string): Display name of the wallet (resolved by caller)
 *   - balance (number): Current balance
 *
 * Outputs:
 *   - Returns (Promise<string | void>): Notification ID
 *
 * Side effects:
 *   - Displays warning notification
 */
export async function showLowBalanceWarning(
  walletName: string,
  balance: number
): Promise<string | void> {
  try {
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return;

    return await notifee.displayNotification({
      title: '⚠️ Low Balance Alert',
      body: `Your ${walletName} is low: $${balance.toFixed(3)} remaining`,
      android: {
        channelId: CHANNEL_IDS.ALERTS,
        color: '#EF476F',
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        sound: 'default',
        criticalVolume: 1.0,
      },
    });
  } catch (error) {
    console.error('[NotificationService] Failed to show low balance warning:', error);
  }
}

// ============================================
// Show Subscription Reminder
// ============================================

/**
 * Purpose: Remind user about upcoming subscription charge
 * 
 * Inputs:
 *   - name (string): Subscription name
 *   - amount (number): Amount to be charged
 *   - daysUntil (number): Days until charge
 * 
 * Outputs:
 *   - Returns (Promise<string | void>): Notification ID
 * 
 * Side effects:
 *   - Displays reminder notification
 */
export async function showSubscriptionReminder(
  name: string,
  amount: number,
  daysUntil: number
): Promise<string | void> {
  try {
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return;

    const dayText = daysUntil <= 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;

    return await notifee.displayNotification({
      title: '📅 Upcoming Subscription',
      body: `${name} ($${amount.toFixed(3)}) will be charged ${dayText}`,
      android: {
        channelId: CHANNEL_IDS.REMINDERS,
        color: '#118AB2',
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        sound: 'default',
      },
    });
  } catch (error) {
    console.error('[NotificationService] Failed to show subscription reminder:', error);
  }
}

// ============================================
// Cancel All Notifications
// ============================================

/**
 * Purpose: Clear all active notifications
 * 
 * Inputs: None
 * 
 * Outputs:
 *   - Returns (Promise<void>): Completes when notifications cleared
 * 
 * Side effects:
 *   - Removes all displayed notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await notifee.cancelAllNotifications();
    console.log('[NotificationService] All notifications cancelled');
  } catch (error) {
    console.error('[NotificationService] Failed to cancel notifications:', error);
  }
}
