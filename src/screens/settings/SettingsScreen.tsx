/**
 * SettingsScreen — Simplizum Architectural Edition
 *
 * Minimalist, sparse, hairline-bordered settings canvas.
 * Organizes application architecture into disciplined functional cards:
 *  1. Financial Identity & Wallets
 *  2. Intelligence & Automation (Gemini / Groq / Laya)
 *  3. Interface & Appearance
 *  4. Security & Biometrics
 *  5. Data Vault & Portability (Full ZIP + Tabular CSV)
 *  6. Danger Zone & Account Wipe
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ThemePickerModal } from '../../components/common/ThemePickerModal';
import { ThemeMode } from '../../contexts/ThemeContext';
import { lightHaptic, mediumHaptic, heavyHaptic, errorHaptic } from '../../services/haptics/hapticFeedback';
import { ordinalDay } from '../../utils/wallets';
import { exportAllData, exportTransactionsCSV } from '../../services/dataTransfer/exportService';
import { pickAndImportData } from '../../services/dataTransfer/importService';
import { database } from '../../database';
import { clearAllMMKVData } from '../../store/middleware/mmkvStorage';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../constants/currencies';

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
  if (notificationSettings.dailyNudgeEnabled) active.push(`Daily ${notificationSettings.nudgeTime}`);
  if (notificationSettings.lowBalanceAlertEnabled) active.push('Balance alerts');
  if (notificationSettings.subscriptionRemindersEnabled || notificationSettings.recurringRemindersEnabled) {
    active.push('Recurring dues');
  }
  if (notificationSettings.salaryReminderEnabled) active.push('Salary day');
  if (notificationSettings.periodicNudgesEnabled) active.push('Periodic 4h');
  return active.length > 0 ? active.join(' · ') : 'All notifications off';
}

export default function SettingsScreen({ navigation }: any) {
  const {
    salarySettings,
    notificationSettings,
    appSettings,
    securitySettings,
    aiSettings,
    updateAppSettings,
  } = useSettingsStore();

  const { logout, currentAccountId, currentUser } = useAuthStore();
  const { clearAccounts } = useAccountStore();
  const themeColors = useThemeColors();

  const [showThemePicker, setShowThemePicker] = useState(false);
  const [currentAccountCurrency, setCurrentAccountCurrency] = useState<string>('USD');
  const [currentAccountName, setCurrentAccountName] = useState<string>('Primary');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingCSV, setIsExportingCSV] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Danger zone modal state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useFocusEffect(
    useCallback(() => {
      loadAccountData();
    }, [currentAccountId])
  );

  const loadAccountData = async () => {
    if (!currentAccountId) return;
    try {
      const { AccountRepository } = await import('../../database/repositories/AccountRepository');
      const accountRepo = new AccountRepository();
      const account = await accountRepo.findById(currentAccountId);
      if (account) {
        setCurrentAccountCurrency(account.currency);
        setCurrentAccountName(account.name);
      }
    } catch (error) {
      console.error('[Settings] Failed to load account:', error);
    }
  };

  const handleThemeChange = (theme: ThemeMode) => {
    lightHaptic();
    updateAppSettings({ theme });
  };

  const handleExportData = async () => {
    lightHaptic();
    if (!currentAccountId || !currentUser) return;
    setIsExporting(true);
    try {
      await exportAllData(currentAccountId, currentUser.id);
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Export Error', error?.message ?? 'Could not export data vault.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    lightHaptic();
    if (!currentAccountId || !currentUser) return;
    setIsExportingCSV(true);
    try {
      await exportTransactionsCSV(currentAccountId, currentUser.id);
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('CSV Export Error', error?.message ?? 'Could not export CSV transactions.');
      }
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleImportData = () => {
    lightHaptic();
    Alert.alert(
      'RESTORE DATA VAULT',
      'Import data from a ZeroWallet backup archive. Existing records will be safely preserved and merged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select Backup File',
          onPress: async () => {
            if (!currentAccountId || !currentUser) return;
            setIsImporting(true);
            try {
              const result = await pickAndImportData(currentAccountId, currentUser.id);
              const { TransactionRepository } = await import('../../database/repositories/TransactionRepository');
              const { calculateVaultBalances } = await import('../../utils/balanceCalculator');
              const txs = await new TransactionRepository().findByAccount(currentAccountId);
              useAccountStore.getState().updateBalance(currentAccountId, calculateVaultBalances(txs));
              await loadAccountData();

              const summary: string[] = [];
              if (result.imported.wallets) summary.push(`${result.imported.wallets} wallets`);
              if (result.imported.transactions) summary.push(`${result.imported.transactions} transactions`);
              if (result.imported.categories) summary.push(`${result.imported.categories} categories`);
              if (result.imported.goals) summary.push(`${result.imported.goals} goals`);
              if (result.imported.debts) summary.push(`${result.imported.debts} debts`);

              Alert.alert('RESTORE SUCCESS', summary.length > 0 ? `Imported: ${summary.join(', ')}` : 'All records up to date.');
            } catch (error: any) {
              if (!error?.message?.includes('cancelled') && !error?.message?.includes('dismissed')) {
                Alert.alert('Import Failed', error?.message ?? 'Could not import archive.');
              }
            } finally {
              setIsImporting(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    mediumHaptic();
    Alert.alert('SIGN OUT', 'Are you sure you want to end your current session?', [
      { text: 'Cancel', style: 'cancel', onPress: () => lightHaptic() },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          heavyHaptic();
          logout();
        },
      },
    ]);
  };

  const handleExecuteDeleteAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      errorHaptic();
      Alert.alert('Verification Failed', 'You must type DELETE exactly to proceed.');
      return;
    }

    try {
      heavyHaptic();
      setIsDeleting(true);
      await database.deleteAllUserData();
      clearAllMMKVData();
      clearAccounts();
      setShowDeleteModal(false);
      logout();
    } catch (error) {
      errorHaptic();
      Alert.alert('Wipe Error', 'Failed to purge database.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getSecurityBadge = () => {
    if (!securitySettings.isEnabled) return 'UNPROTECTED';
    return securitySettings.authType === 'biometric' ? 'BIOMETRIC ACTIVE' : 'PIN ACTIVE';
  };

  const getAIBadge = () => {
    if (!aiSettings?.isConfigured) return 'NOT CONFIGURED';
    const model = aiSettings.selectedModel || 'Gemini 2.5 Flash';
    return model.toUpperCase();
  };

  return (
    <View style={styles.root}>
      {/* Architectural Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSuper}>ZERO WALLET · OS CONFIG</Text>
          <Text style={styles.headerTitle}>SETTINGS</Text>
        </View>
        <View style={styles.accountPill}>
          <Text style={styles.accountPillText}>
            {currentAccountName.toUpperCase()} · {currentAccountCurrency}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* GROUP 1: FINANCIAL IDENTITY & LEDGER */}
        <View style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>FINANCIAL IDENTITY & WALLETS</Text>
          </View>

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              lightHaptic();
              if (currentAccountId) {
                navigation.navigate('AccountSettings', { accountId: currentAccountId });
              }
            }}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Base Currency</Text>
              <Text style={styles.rowDesc}>Default denomination for all reports</Text>
            </View>
            <View style={styles.rowRight}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{currentAccountCurrency}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              lightHaptic();
              navigation.navigate('Wallets');
            }}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Wallets & Accounts</Text>
              <Text style={styles.rowDesc}>Architectural multi-vault management</Text>
            </View>
            <View style={styles.rowRight}>
              <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              lightHaptic();
              navigation.navigate('SalarySettings');
            }}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Auto-Salary Inflow</Text>
              <Text style={styles.rowDesc}>
                {salarySettings.isEnabled
                  ? `${formatCurrency(salarySettings.amount, currentAccountCurrency)} on the ${ordinalDay(
                      salarySettings.payDay ?? 1
                    )}`
                  : 'Automatic monthly payroll schedule'}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <View style={[styles.badge, salarySettings.isEnabled ? styles.badgeActive : null]}>
                <Text style={[styles.badgeText, salarySettings.isEnabled ? styles.badgeActiveText : null]}>
                  {salarySettings.isEnabled ? 'ENABLED' : 'OFF'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* GROUP 2: INTELLIGENCE & AUTOMATION */}
        <View style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>INTELLIGENCE & AUTOMATION</Text>
          </View>

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              lightHaptic();
              navigation.navigate('AISettings');
            }}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>AI Assistant (Laya)</Text>
              <Text style={styles.rowDesc}>Multi-provider SLM router & Gemini 2.5</Text>
            </View>
            <View style={styles.rowRight}>
              <View style={[styles.badge, aiSettings?.isConfigured ? styles.badgeActive : null]}>
                <Text style={[styles.badgeText, aiSettings?.isConfigured ? styles.badgeActiveText : null]}>
                  {getAIBadge()}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              lightHaptic();
              navigation.navigate('SmartNudges');
            }}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Smart Nudges & Alerts</Text>
              <Text style={styles.rowDesc} numberOfLines={1}>
                {smartNudgesSummary(notificationSettings)}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* GROUP 3: APP EXPERIENCE & THEMES */}
        <View style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>INTERFACE & APPEARANCE</Text>
          </View>

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              lightHaptic();
              setShowThemePicker(true);
            }}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Color Theme Mode</Text>
              <Text style={styles.rowDesc}>Minimalist dual-palette system</Text>
            </View>
            <View style={styles.rowRight}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {(appSettings.theme || 'SYSTEM').toUpperCase()}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Haptic Feedback</Text>
              <Text style={styles.rowDesc}>Tactile confirmation on touch interactions</Text>
            </View>
            <Switch
              value={appSettings.hapticFeedback}
              onValueChange={(val) => {
                lightHaptic();
                updateAppSettings({ hapticFeedback: val });
              }}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>
        </View>

        {/* GROUP 4: SECURITY & VAULT SHIELD */}
        <View style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>SECURITY & VAULT SHIELD</Text>
          </View>

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              lightHaptic();
              navigation.navigate('SecuritySettings');
            }}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>App Lock & Biometrics</Text>
              <Text style={styles.rowDesc}>Face ID, Fingerprint & Master PIN</Text>
            </View>
            <View style={styles.rowRight}>
              <View style={[styles.badge, securitySettings.isEnabled ? styles.badgeActive : styles.badgeDanger]}>
                <Text
                  style={[
                    styles.badgeText,
                    securitySettings.isEnabled ? styles.badgeActiveText : styles.badgeDangerText,
                  ]}
                >
                  {getSecurityBadge()}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* GROUP 5: DATA VAULT & PORTABILITY */}
        <View style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>DATA VAULT & PORTABILITY</Text>
          </View>

          <TouchableOpacity
            style={styles.row}
            onPress={handleExportData}
            disabled={isExporting}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Full System Backup</Text>
              <Text style={styles.rowDesc}>Encrypted JSON snapshot with receipts & configurations</Text>
            </View>
            <View style={styles.rowRight}>
              {isExporting ? (
                <ActivityIndicator size="small" color={themeColors.text} />
              ) : (
                <MaterialCommunityIcons name="download-outline" size={20} color={themeColors.text} />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={handleExportCSV}
            disabled={isExportingCSV}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Export Ledger (CSV)</Text>
              <Text style={styles.rowDesc}>Tabular spreadsheet of all transactions & metadata</Text>
            </View>
            <View style={styles.rowRight}>
              {isExportingCSV ? (
                <ActivityIndicator size="small" color={themeColors.text} />
              ) : (
                <MaterialCommunityIcons name="file-delimited-outline" size={20} color={themeColors.text} />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={handleImportData}
            disabled={isImporting}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Restore Data Archive</Text>
              <Text style={styles.rowDesc}>Merge previous backups back into active ledger</Text>
            </View>
            <View style={styles.rowRight}>
              {isImporting ? (
                <ActivityIndicator size="small" color={themeColors.text} />
              ) : (
                <MaterialCommunityIcons name="upload-outline" size={20} color={themeColors.text} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* GROUP 6: DANGER ZONE & SESSION */}
        <View style={[styles.groupCard, styles.dangerCard]}>
          <View style={styles.groupHeader}>
            <Text style={[styles.groupTitle, styles.dangerTitle]}>SYSTEM AUDIT & DANGER ZONE</Text>
          </View>

          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Sign Out Session</Text>
              <Text style={styles.rowDesc}>Close current user workspace securely</Text>
            </View>
            <MaterialCommunityIcons name="logout" size={18} color={themeColors.text} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              heavyHaptic();
              setDeleteConfirmationText('');
              setShowDeleteModal(true);
            }}
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowLabel, styles.dangerText]}>Permanently Purge Ledger</Text>
              <Text style={styles.rowDesc}>Erase all wallets, transactions, and categories forever</Text>
            </View>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        {/* System Build Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ZEROWALLET · V1.0 ARCHITECTURAL RELEASE</Text>
          <Text style={styles.footerSubText}>OFFLINE-FIRST · MATHEMATICAL TRUTH ENGINE</Text>
        </View>
      </ScrollView>

      {/* Theme Picker Modal */}
      <ThemePickerModal
        visible={showThemePicker}
        currentTheme={appSettings.theme}
        onSelect={handleThemeChange}
        onClose={() => setShowThemePicker(false)}
      />

      {/* High-Safety Delete Verification Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTag}>CRITICAL SAFEGUARD</Text>
              <Text style={styles.modalTitle}>PERMANENT DATA WIPE</Text>
            </View>

            <Text style={styles.modalBody}>
              This action will permanently purge all accounts, wallets, transactions, goals, debts, and
              settings. It cannot be reversed or restored unless you have an exported backup.
            </Text>

            <View style={styles.typeConfirmBox}>
              <Text style={styles.typeConfirmLabel}>Type DELETE to confirm authorization:</Text>
              <TextInput
                style={styles.confirmInput}
                value={deleteConfirmationText}
                onChangeText={setDeleteConfirmationText}
                placeholder="DELETE"
                placeholderTextColor={themeColors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  lightHaptic();
                  setShowDeleteModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.destructiveButton,
                  deleteConfirmationText.trim().toUpperCase() !== 'DELETE' ? styles.buttonDisabled : null,
                ]}
                onPress={handleExecuteDeleteAccount}
                disabled={deleteConfirmationText.trim().toUpperCase() !== 'DELETE' || isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.destructiveButtonText}>PURGE EVERYTHING</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
    },
    headerSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
      marginBottom: 2,
    },
    headerTitle: {
      ...typography.h2,
      color: theme.text,
      letterSpacing: 0.5,
      fontWeight: '700',
    },
    accountPill: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 2,
    },
    accountPillText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxl + 40,
    },
    groupCard: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    groupHeader: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
    },
    groupTitle: {
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
      minHeight: 56,
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
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    divider: {
      height: 1,
      backgroundColor: theme.hairline || theme.border,
      marginLeft: spacing.md,
    },
    badge: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: 2,
      backgroundColor: theme.background,
    },
    badgeText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    badgeActive: {
      borderColor: theme.text,
      backgroundColor: theme.text,
    },
    badgeActiveText: {
      color: theme.background,
    },
    badgeDanger: {
      borderColor: '#FF3B30',
      backgroundColor: '#FF3B3015',
    },
    badgeDangerText: {
      color: '#FF3B30',
    },
    dangerCard: {
      borderColor: '#FF3B3040',
    },
    dangerTitle: {
      color: '#FF3B30',
    },
    dangerText: {
      color: '#FF3B30',
    },
    footer: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    footerText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: '600',
      marginBottom: 2,
    },
    footerSubText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      letterSpacing: 0.8,
      opacity: 0.6,
    },
    // Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalBox: {
      width: '100%',
      backgroundColor: theme.card || theme.surface,
      borderWidth: 1,
      borderColor: '#FF3B30',
      borderRadius: 2,
      padding: spacing.lg,
    },
    modalHeader: {
      marginBottom: spacing.sm,
    },
    modalTag: {
      ...typography.caption,
      color: '#FF3B30',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
    },
    modalTitle: {
      ...typography.h3,
      color: theme.text,
      fontWeight: '700',
      marginTop: 2,
    },
    modalBody: {
      ...typography.body,
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: spacing.md,
    },
    typeConfirmBox: {
      marginBottom: spacing.lg,
    },
    typeConfirmLabel: {
      ...typography.caption,
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    confirmInput: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      color: theme.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 2,
      fontFamily: 'monospace',
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 2,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    cancelButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelButtonText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      letterSpacing: 1,
    },
    destructiveButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: '#FF3B30',
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 140,
    },
    destructiveButtonText: {
      ...typography.caption,
      color: '#FFFFFF',
      fontWeight: '700',
      letterSpacing: 1,
    },
    buttonDisabled: {
      opacity: 0.35,
    },
  });
