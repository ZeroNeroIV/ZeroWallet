/**
 * Purpose: Settings screen with salary, notifications, and app preferences
 * 
 * Inputs:
 *   - navigation (SettingsScreenProps): Navigation object from React Navigation
 * 
 * Outputs:
 *   - Returns (JSX.Element): Settings screen with all configuration options
 * 
 * Side effects:
 *   - Updates settings store when toggles/values change
 *   - Navigates to salary configuration screen
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { compatColors as colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { getNextSalaryDate } from '../../services/backgroundTasks/autoSalaryTask';
import { ThemePickerModal } from '../../components/common/ThemePickerModal';
import { ThemeMode } from '../../contexts/ThemeContext';
import { lightHaptic, mediumHaptic, heavyHaptic } from '../../services/haptics/hapticFeedback';
import { ordinalDay } from '../../utils/wallets';
import { exportAllData } from '../../services/dataTransfer/exportService';
import { pickAndImportData } from '../../services/dataTransfer/importService';
import { database } from '../../database';
import { clearAllMMKVData } from '../../store/middleware/mmkvStorage';
import { useThemeColors } from '../../hooks/useThemeColors';

function smartNudgesSummary(notificationSettings: {
  dailyNudgeEnabled: boolean;
  nudgeTime: string;
  lowBalanceAlertEnabled: boolean;
  subscriptionRemindersEnabled: boolean;
  recurringRemindersEnabled: boolean;
  salaryReminderEnabled: boolean;
  periodicNudgesEnabled: boolean;
}): string {
  const active: string[] = [];
  if (notificationSettings.dailyNudgeEnabled) {
    active.push(`daily ${notificationSettings.nudgeTime}`);
  }
  if (notificationSettings.lowBalanceAlertEnabled) {
    active.push('low money');
  }
  if (notificationSettings.subscriptionRemindersEnabled) {
    active.push('subscriptions');
  }
  if (notificationSettings.recurringRemindersEnabled) {
    active.push('recurring');
  }
  if (notificationSettings.salaryReminderEnabled) {
    active.push('salary day');
  }
  if (notificationSettings.periodicNudgesEnabled) {
    active.push('4-hour');
  }
  return active.length > 0 ? active.join(' · ') : 'All nudges off';
}

const SettingsScreen = ({ navigation }: any) => {
  const { salarySettings, notificationSettings, appSettings, securitySettings, aiSettings, updateAppSettings } =
    useSettingsStore();
  const { logout, currentAccountId, currentUser } = useAuthStore();
  const { clearAccounts } = useAccountStore();
  const themeColors = useThemeColors();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [currentAccountCurrency, setCurrentAccountCurrency] = useState<string>('USD');

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Load current account currency
  useEffect(() => {
    loadCurrentAccount();
  }, [currentAccountId]);

  const loadCurrentAccount = async () => {
    if (!currentAccountId) return;
    try {
      const { AccountRepository } = await import('../../database/repositories/AccountRepository');
      const accountRepo = new AccountRepository();
      const account = await accountRepo.findById(currentAccountId);
      if (account) {
        setCurrentAccountCurrency(account.currency);
      }
    } catch (error) {
      console.error('[Settings] Failed to load account:', error);
    }
  };

  // Handle theme change
  const handleThemeChange = (theme: ThemeMode) => {
    lightHaptic();
    updateAppSettings({ theme });
  };

  // Handle logout
  const handleLogout = () => {
    mediumHaptic();

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => lightHaptic(),
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            heavyHaptic();
            setIsLoggingOut(true);
            setTimeout(() => {
              logout();
              setIsLoggingOut(false);
            }, 500);
          },
        },
      ]
    );
  };

  // Handle account deletion
  const handleDeleteAccount = () => {
    heavyHaptic();

    Alert.alert(
      'Delete Account',
      'This will permanently delete all your data including accounts, transactions, categories, subscriptions, and recurring expenses. This action cannot be undone!',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => lightHaptic(),
        },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Warning',
              'Type DELETE to confirm account deletion',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      heavyHaptic();
                      // Clear all data from database
                      await database.deleteAllUserData();
                      // Clear MMKV storage
                      clearAllMMKVData();
                      // Clear account store
                      clearAccounts();
                      // Logout
                      logout();
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete account data');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    lightHaptic();
    if (!currentAccountId || !currentUser) return;
    try {
      await exportAllData(currentAccountId, currentUser.id);
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Export Failed', error?.message ?? 'Could not export data');
      }
    }
  };

  const handleImportData = () => {
    lightHaptic();
    Alert.alert(
      'Import Data',
      'This will add data from a backup file to your account. Existing records will not be overwritten.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose File',
          onPress: async () => {
            if (!currentAccountId || !currentUser) return;
            try {
              const result = await pickAndImportData(currentAccountId, currentUser.id);
              // Recalculate balances so home reflects the imported data now
              const { TransactionRepository } = await import('../../database/repositories/TransactionRepository');
              const { calculateVaultBalances } = await import('../../utils/balanceCalculator');
              const { useAccountStore } = await import('../../store/accountStore');
              const txs = await new TransactionRepository().findByAccount(currentAccountId);
              useAccountStore.getState().updateBalance(currentAccountId, calculateVaultBalances(txs));
              const summary = Object.entries(result.imported)
                .map(([k, v]) => `${v} ${k}`)
                .join(', ');
              Alert.alert('Import Complete', `Imported: ${summary}`);
            } catch (error: any) {
              if (!error?.message?.includes('cancelled') && !error?.message?.includes('dismissed')) {
                Alert.alert('Import Failed', error?.message ?? 'Could not import data');
              }
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Salary Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Auto-Salary</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => navigation.navigate('SalarySettings')}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.semantic.successLight }]}>
              <MaterialCommunityIcons
                name="cash-multiple"
                size={20}
                color={colors.semantic.success}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Monthly Salary</Text>
              <Text style={styles.settingValue}>
                {salarySettings.isEnabled
                  ? `$${salarySettings.amount.toFixed(3)} on ${ordinalDay(salarySettings.payDay ?? 1)} of month`
                  : 'Not configured'}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        {salarySettings.isEnabled && (
          <View style={styles.infoBox}>
            <MaterialCommunityIcons
              name="information-outline"
              size={16}
              color={colors.primary.main}
            />
            <Text style={styles.infoText}>
              Next salary: {getNextSalaryDate(salarySettings.nextProcessing)}
            </Text>
          </View>
        )}
      </View>

      {/* Wallets Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallets</Text>

        <TouchableOpacity
          style={[styles.settingRow, styles.lastRow]}
          onPress={() => {
            lightHaptic();
            navigation.navigate('Wallets');
          }}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary.light }]}>
              <MaterialCommunityIcons
                name="wallet-outline"
                size={20}
                color={colors.primary.main}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>My Wallets</Text>
              <Text style={styles.settingDescription}>
                Add, rename and remove wallets
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Notification Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <TouchableOpacity
          style={[styles.settingRow, styles.lastRow]}
          onPress={() => {
            lightHaptic();
            navigation.navigate('SmartNudges');
          }}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.semantic.warningLight }]}>
              <MaterialCommunityIcons
                name="bell-outline"
                size={20}
                color={colors.semantic.warning}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Smart Nudges</Text>
              <Text style={styles.settingDescription}>
                {smartNudgesSummary(notificationSettings)}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* AI Assistant Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Assistant</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            lightHaptic();
            navigation.navigate('AISettings');
          }}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary.light }]}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={20}
                color={colors.primary.main}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Gemini AI Chat</Text>
              <Text style={styles.settingDescription}>
                {aiSettings.isConfigured
                  ? 'Configured - Ready to use'
                  : 'Set up free AI assistant'}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        {!aiSettings.isConfigured && (
          <View style={styles.infoBox}>
            <MaterialCommunityIcons
              name="gift"
              size={16}
              color={colors.success.main}
            />
            <Text style={[styles.infoText, { color: colors.success.main }]}>
              100% FREE - Get insights about your spending in seconds!
            </Text>
          </View>
        )}
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            lightHaptic();
            navigation.navigate('SecuritySettings');
          }}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.semantic.warningLight }]}>
              <MaterialCommunityIcons
                name="shield-lock"
                size={20}
                color={colors.semantic.warning}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>App Lock</Text>
              <Text style={styles.settingDescription}>
                {securitySettings.isEnabled
                  ? securitySettings.authType === 'biometric'
                    ? 'Biometric authentication enabled'
                    : 'PIN authentication enabled'
                  : 'Not configured'}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* App Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Preferences</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            lightHaptic();
            setShowThemePicker(true);
          }}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: themeColors.textSecondary + '20' }]}>
              <MaterialCommunityIcons
                name="theme-light-dark"
                size={20}
                color={themeColors.text}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Theme</Text>
              <Text style={styles.settingDescription}>
                {appSettings.theme === 'system'
                  ? 'Follow system'
                  : appSettings.theme === 'dark'
                    ? 'Dark mode'
                    : 'Light mode'}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.semantic.errorLight }]}>
              <MaterialCommunityIcons
                name="vibrate"
                size={20}
                color={colors.semantic.error}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
              <Text style={styles.settingDescription}>
                Vibration on interactions
              </Text>
            </View>
          </View>
          <Switch
            value={appSettings.hapticFeedback}
            onValueChange={(value) =>
              updateAppSettings({ hapticFeedback: value })
            }
            trackColor={{
              false: colors.neutral.gray300,
              true: colors.primary.light,
            }}
            thumbColor={
              appSettings.hapticFeedback
                ? colors.primary.main
                : colors.neutral.gray500
            }
          />
        </View>
      </View>

      {/* Account Actions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => {
            lightHaptic();
            if (currentAccountId) {
              navigation.navigate('AccountSettings', { accountId: currentAccountId });
            }
          }}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary.light }]}>
              <MaterialCommunityIcons
                name="currency-usd"
                size={20}
                color={colors.primary.main}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Currency</Text>
              <Text style={styles.settingValue}>
                {currentAccountCurrency}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={handleExportData}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.semantic.successLight }]}>
              <MaterialCommunityIcons
                name="database-export"
                size={20}
                color={colors.semantic.success}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Export Data</Text>
              <Text style={styles.settingDescription}>
                Save full backup as JSON file
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={handleImportData}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.semantic.infoLight }]}>
              <MaterialCommunityIcons
                name="database-import"
                size={20}
                color={colors.semantic.info}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Import Data</Text>
              <Text style={styles.settingDescription}>
                Restore from a backup JSON file
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.semantic.warningLight }]}>
              <MaterialCommunityIcons
                name={isLoggingOut ? 'loading' : 'logout'}
                size={20}
                color={colors.semantic.warning}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.semantic.warning }]}>
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, styles.lastRow]}
          onPress={handleDeleteAccount}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.semantic.errorLight }]}>
              <MaterialCommunityIcons
                name="delete-forever"
                size={20}
                color={colors.semantic.error}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.semantic.error }]}>
                Delete Account
              </Text>
              <Text style={styles.settingDescription}>
                Permanently delete all data
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={colors.semantic.error}
          />
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>Wallet App v1.0.0</Text>
        <Text style={styles.appInfoText}>© 2026</Text>
      </View>

      {/* Theme Picker Modal */}
      <ThemePickerModal
        visible={showThemePicker}
        currentTheme={appSettings.theme}
        onSelect={handleThemeChange}
        onClose={() => {
          lightHaptic();
          setShowThemePicker(false);
        }}
      />
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
    },
    sectionTitle: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    settingInfo: {
      flex: 1,
    },
    settingLabel: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 2,
    },
    settingDescription: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    settingValue: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '500',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary.light + '30',
      marginHorizontal: spacing.md,
      marginVertical: spacing.xs,
      padding: spacing.sm,
      borderRadius: 8,
      gap: spacing.xs,
    },
    infoText: {
      ...typography.caption,
      color: colors.primary.main,
      flex: 1,
    },
    appInfo: {
      alignItems: 'center',
      marginTop: spacing.xl,
      paddingVertical: spacing.md,
    },
    appInfoText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginVertical: 2,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
  });

export default SettingsScreen;
