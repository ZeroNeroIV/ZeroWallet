/**
 * SmartNudgesScreen — Simplizum Architectural Edition
 *
 * Unified notification & alert dispatch management:
 * - Daily summary trigger time
 * - Periodic 4-hour background nudges
 * - Low wallet balance warning thresholds
 * - Due subscription & recurring expense lead time steppers
 * - Salary arrival notifications
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import {
  scheduleDailyNudge,
  cancelDailyNudge,
  schedulePeriodicNudges,
  cancelPeriodicNudges,
  scheduleSalaryReminder,
  cancelSalaryReminder,
  scheduleDueReminders,
  cancelDueReminders,
} from '../../services/notifications/scheduleNudges';
import { useAuthStore } from '../../store/authStore';

function isValidTime(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export default function SmartNudgesScreen({ navigation }: any) {
  const { notificationSettings, salarySettings, updateNotificationSettings } = useSettingsStore();
  const { currentAccountId } = useAuthStore();
  const themeColors = useThemeColors();

  const [nudgeTime, setNudgeTime] = useState(notificationSettings.nudgeTime);
  const [threshold, setThreshold] = useState(notificationSettings.lowBalanceThreshold.toString());

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const refreshDue = () => {
    if (currentAccountId) {
      scheduleDueReminders(currentAccountId);
    }
  };

  const clearDue = (kind: 'subscription' | 'recurring') => {
    if (currentAccountId) {
      cancelDueReminders(currentAccountId, kind);
    }
  };

  const toggleDaily = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ dailyNudgeEnabled: value });
    if (value) scheduleDailyNudge();
    else cancelDailyNudge();
  };

  const saveTime = () => {
    if (!isValidTime(nudgeTime)) {
      Alert.alert('Invalid Format', 'Use 24-hour HH:MM format, e.g. 21:00');
      return;
    }
    mediumHaptic();
    updateNotificationSettings({ nudgeTime: nudgeTime.trim() });
    if (notificationSettings.dailyNudgeEnabled) {
      scheduleDailyNudge();
    }
    Alert.alert('SAVED', `Daily briefing scheduled for ${nudgeTime.trim()}`);
  };

  const togglePeriodic = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ periodicNudgesEnabled: value });
    if (value) schedulePeriodicNudges();
    else cancelPeriodicNudges();
  };

  const toggleLowBalance = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ lowBalanceAlertEnabled: value });
  };

  const saveThreshold = () => {
    const amount = parseFloat(threshold);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Invalid Threshold', 'Enter a valid non-negative amount.');
      return;
    }
    mediumHaptic();
    updateNotificationSettings({ lowBalanceThreshold: amount });
    Alert.alert('SAVED', `Low balance alert threshold updated to $${amount}`);
  };

  const toggleSubscriptions = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ subscriptionRemindersEnabled: value });
    if (value) refreshDue();
    else clearDue('subscription');
  };

  const toggleRecurring = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ recurringRemindersEnabled: value });
    if (value) refreshDue();
    else clearDue('recurring');
  };

  const changeDays = (key: 'subscriptionDaysBefore' | 'recurringDaysBefore', delta: number) => {
    lightHaptic();
    const current = notificationSettings[key];
    const next = Math.min(7, Math.max(0, current + delta));
    if (key === 'subscriptionDaysBefore') {
      updateNotificationSettings({ subscriptionDaysBefore: next });
    } else {
      updateNotificationSettings({ recurringDaysBefore: next });
    }
    refreshDue();
  };

  const toggleSalary = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ salaryReminderEnabled: value });
    if (value) scheduleSalaryReminder();
    else cancelSalaryReminder();
  };

  const renderStepper = (
    value: number,
    onChange: (delta: number) => void,
    label: string
  ) => (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControl}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(-1)}>
          <MaterialCommunityIcons name="minus" size={16} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={styles.stepperText}>{value} {value === 1 ? 'DAY' : 'DAYS'} BEFORE</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(1)}>
          <MaterialCommunityIcons name="plus" size={16} color={themeColors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            lightHaptic();
            navigation.goBack();
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={themeColors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerSuper}>NOTIFICATIONS & ALERTS</Text>
          <Text style={styles.headerTitle}>SMART NUDGES</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* CARD 1: DAILY SPENDING BRIEFING */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>DAILY SPENDING BRIEFING</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Evening Ledger Check-in</Text>
              <Text style={styles.rowDesc}>Prompt to record today's unaccounted transactions</Text>
            </View>
            <Switch
              value={notificationSettings.dailyNudgeEnabled}
              onValueChange={toggleDaily}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>

          {notificationSettings.dailyNudgeEnabled && (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.timeInput}
                value={nudgeTime}
                onChangeText={setNudgeTime}
                placeholder="20:00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveTime}>
                <Text style={styles.saveBtnText}>SET TIME (24H)</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* CARD 2: PERIODIC 4-HOUR CADENCE */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>PERIODIC 4-HOUR CADENCE</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Active Day Reminders</Text>
              <Text style={styles.rowDesc}>Subtle check-ins at 08:00, 12:00, 16:00, and 20:00</Text>
            </View>
            <Switch
              value={notificationSettings.periodicNudgesEnabled}
              onValueChange={togglePeriodic}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>
        </View>

        {/* CARD 3: LOW BALANCE THRESHOLD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>LOW BALANCE THRESHOLD</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Depletion Warning</Text>
              <Text style={styles.rowDesc}>Instant alert when any wallet drops below minimum</Text>
            </View>
            <Switch
              value={notificationSettings.lowBalanceAlertEnabled}
              onValueChange={toggleLowBalance}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>

          {notificationSettings.lowBalanceAlertEnabled && (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.timeInput}
                value={threshold}
                onChangeText={setThreshold}
                placeholder="50.00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveThreshold}>
                <Text style={styles.saveBtnText}>UPDATE THRESHOLD</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* CARD 4: RECURRING DUES & SUBSCRIPTIONS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>RECURRING DUES & SUBSCRIPTIONS</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Subscription Billing Warnings</Text>
              <Text style={styles.rowDesc}>Prior notification before automatic renewals</Text>
            </View>
            <Switch
              value={notificationSettings.subscriptionRemindersEnabled}
              onValueChange={toggleSubscriptions}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>
          {notificationSettings.subscriptionRemindersEnabled &&
            renderStepper(
              notificationSettings.subscriptionDaysBefore,
              (d) => changeDays('subscriptionDaysBefore', d),
              'DISPATCH ADVANCE WARNING'
            )}

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Recurring Expense Alerts</Text>
              <Text style={styles.rowDesc}>Prior notice for utility bills, rent & cadence costs</Text>
            </View>
            <Switch
              value={notificationSettings.recurringRemindersEnabled}
              onValueChange={toggleRecurring}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>
          {notificationSettings.recurringRemindersEnabled &&
            renderStepper(
              notificationSettings.recurringDaysBefore,
              (d) => changeDays('recurringDaysBefore', d),
              'DISPATCH ADVANCE WARNING'
            )}
        </View>

        {/* CARD 5: SALARY DAY REMINDER */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>PAYDAY INFLOW ALERT</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Salary Credit Confirmation</Text>
              <Text style={styles.rowDesc}>
                {salarySettings.isEnabled
                  ? `Notifies on the ${salarySettings.payDay ?? 1}st of each month`
                  : 'Configure auto-salary first in settings'}
              </Text>
            </View>
            <Switch
              value={notificationSettings.salaryReminderEnabled}
              onValueChange={toggleSalary}
              disabled={!salarySettings.isEnabled}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      gap: spacing.sm,
    },
    backButton: {
      width: 36,
      height: 36,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitles: {
      flex: 1,
    },
    headerSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
    },
    headerTitle: {
      ...typography.h3,
      color: theme.text,
      letterSpacing: 0.5,
      fontWeight: '700',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxl + 40,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    cardHeader: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
    },
    cardHeaderTitle: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    rowLeft: {
      flex: 1,
      marginRight: spacing.md,
    },
    rowLabel: {
      ...typography.body,
      color: theme.text,
      fontWeight: '600',
      fontSize: 14,
      marginBottom: 2,
    },
    rowDesc: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 12,
    },
    divider: {
      height: 1,
      backgroundColor: theme.hairline || theme.border,
      marginLeft: spacing.md,
    },
    inputRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    timeInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      color: theme.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 2,
      fontFamily: 'monospace',
      fontSize: 14,
      fontWeight: '700',
    },
    saveBtn: {
      borderWidth: 1,
      borderColor: theme.text,
      backgroundColor: theme.text,
      paddingHorizontal: spacing.md,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    saveBtnText: {
      ...typography.caption,
      color: theme.background,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    stepperRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    stepperLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    stepperControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      backgroundColor: theme.background,
    },
    stepBtn: {
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepperText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
      fontFamily: 'monospace',
      letterSpacing: 0.5,
    },
  });
