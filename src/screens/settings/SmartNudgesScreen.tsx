/**
 * Purpose: Smart Nudges hub — every reminder in one customizable page
 *
 * Inputs:
 *   - navigation: Navigation object from React Navigation
 *
 * Outputs:
 *   - Returns (JSX.Element): Nudge preferences screen
 *
 * Side effects:
 *   - Updates notification settings in store
 *   - (Re)schedules daily, periodic, due-date and salary reminders
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
import { compatColors as colors } from '../../theme/colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic } from '../../services/haptics/hapticFeedback';
import { AmountInput } from '../../components/forms/AmountInput';
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

const SmartNudgesScreen = () => {
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
    if (value) {
      scheduleDailyNudge();
    } else {
      cancelDailyNudge();
    }
  };

  const saveTime = () => {
    if (!isValidTime(nudgeTime)) {
      Alert.alert('Invalid time', 'Use 24-hour HH:MM format, e.g. 20:00');
      return;
    }
    lightHaptic();
    updateNotificationSettings({ nudgeTime: nudgeTime.trim() });
    if (notificationSettings.dailyNudgeEnabled) {
      scheduleDailyNudge();
    }
  };

  const togglePeriodic = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ periodicNudgesEnabled: value });
    if (value) {
      schedulePeriodicNudges();
    } else {
      cancelPeriodicNudges();
    }
  };

  const toggleLowBalance = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ lowBalanceAlertEnabled: value });
  };

  const saveThreshold = () => {
    const amount = parseFloat(threshold);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Invalid amount', 'Enter a valid threshold of 0 or more');
      return;
    }
    lightHaptic();
    updateNotificationSettings({ lowBalanceThreshold: amount });
  };

  const toggleSubscriptions = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ subscriptionRemindersEnabled: value });
    if (value) {
      refreshDue();
    } else {
      clearDue('subscription');
    }
  };

  const toggleRecurring = (value: boolean) => {
    lightHaptic();
    updateNotificationSettings({ recurringRemindersEnabled: value });
    if (value) {
      refreshDue();
    } else {
      clearDue('recurring');
    }
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
    if (value) {
      scheduleSalaryReminder();
    } else {
      cancelSalaryReminder();
    }
  };

  const renderSwitch = (value: boolean, onChange: (v: boolean) => void) => (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.neutral.gray300, true: colors.primary.light }}
      thumbColor={value ? colors.primary.main : colors.neutral.gray500}
    />
  );

  const renderStepper = (
    value: number,
    onChange: (delta: number) => void,
    label: string,
  ) => (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepperButton} onPress={() => onChange(-1)}>
          <MaterialCommunityIcons name="minus" size={18} color={themeColors.primary} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value} {value === 1 ? 'day' : 'days'}</Text>
        <TouchableOpacity style={styles.stepperButton} onPress={() => onChange(1)}>
          <MaterialCommunityIcons name="plus" size={18} color={themeColors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Daily nudge */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Nudge</Text>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Daily reminder</Text>
            <Text style={styles.rowDescription}>A friendly ping to log your spending</Text>
          </View>
          {renderSwitch(notificationSettings.dailyNudgeEnabled, toggleDaily)}
        </View>
        <View style={styles.inlineRow}>
          <TextInput
            style={styles.timeInput}
            value={nudgeTime}
            onChangeText={setNudgeTime}
            placeholder="20:00"
            placeholderTextColor={themeColors.textSecondary}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            editable={notificationSettings.dailyNudgeEnabled}
          />
          <TouchableOpacity
            style={styles.saveChip}
            onPress={saveTime}
            disabled={!notificationSettings.dailyNudgeEnabled}
          >
            <Text style={styles.saveChipText}>Set time</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4-hour nudges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4-Hour Nudges</Text>
        <View style={[styles.row, styles.lastRow]}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Remind every 4 hours</Text>
            <Text style={styles.rowDescription}>Nudges at 0, 4, 8, 12, 16 and 20 o'clock</Text>
          </View>
          {renderSwitch(notificationSettings.periodicNudgesEnabled, togglePeriodic)}
        </View>
      </View>

      {/* Low money alert */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Low Money Alert</Text>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Warn when wallets run low</Text>
            <Text style={styles.rowDescription}>Alert when any wallet drops below the threshold</Text>
          </View>
          {renderSwitch(notificationSettings.lowBalanceAlertEnabled, toggleLowBalance)}
        </View>
        <View style={styles.inlineColumn}>
          <AmountInput
            value={threshold}
            onChangeText={setThreshold}
            placeholder="0.000"
            editable={notificationSettings.lowBalanceAlertEnabled}
          />
          <TouchableOpacity
            style={styles.saveChip}
            onPress={saveThreshold}
            disabled={!notificationSettings.lowBalanceAlertEnabled}
          >
            <Text style={styles.saveChipText}>Set threshold</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Due subscriptions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Due Subscriptions</Text>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Remind before billing</Text>
            <Text style={styles.rowDescription}>Heads-up before a subscription charges you</Text>
          </View>
          {renderSwitch(notificationSettings.subscriptionRemindersEnabled, toggleSubscriptions)}
        </View>
        {renderStepper(notificationSettings.subscriptionDaysBefore, (d) => changeDays('subscriptionDaysBefore', d), 'Remind me')}
      </View>

      {/* Recurring expenses */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recurring Expenses</Text>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Remind before charge</Text>
            <Text style={styles.rowDescription}>Heads-up before a recurring expense hits</Text>
          </View>
          {renderSwitch(notificationSettings.recurringRemindersEnabled, toggleRecurring)}
        </View>
        {renderStepper(notificationSettings.recurringDaysBefore, (d) => changeDays('recurringDaysBefore', d), 'Remind me')}
      </View>

      {/* Salary day */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Salary Day</Text>
        <View style={[styles.row, styles.lastRow]}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Salary day reminder</Text>
            <Text style={styles.rowDescription}>
              {salarySettings.isEnabled
                ? `Remind on payday morning (${salarySettings.payDay ?? 1} of each month)`
                : 'Enable auto-salary first to get payday reminders'}
            </Text>
          </View>
          {renderSwitch(notificationSettings.salaryReminderEnabled, toggleSalary)}
        </View>
      </View>
    </ScrollView>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    content: {
      paddingBottom: spacing.xl,
    },
    section: {
      backgroundColor: themeColors.surface,
      marginTop: spacing.md,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    sectionTitle: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
      paddingVertical: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
    rowInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    rowLabel: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 2,
    },
    rowDescription: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    inlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    inlineColumn: {
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    timeInput: {
      ...typography.body,
      color: themeColors.text,
      backgroundColor: themeColors.background,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 12,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minWidth: 110,
      textAlign: 'center',
    },
    saveChip: {
      backgroundColor: themeColors.primary,
      borderRadius: 12,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
    },
    saveChipText: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFF',
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    stepperLabel: {
      ...typography.body,
      color: themeColors.textSecondary,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    stepperButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.primary + '15',
    },
    stepperValue: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
      minWidth: 64,
      textAlign: 'center',
    },
  });

export default SmartNudgesScreen;
