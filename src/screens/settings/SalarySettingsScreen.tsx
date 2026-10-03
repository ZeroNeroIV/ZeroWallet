/**
 * SalarySettingsScreen — Simplizum Architectural Edition
 *
 * Automatic monthly payroll recurring scheduler:
 * - Direct monthly salary amount configuration
 * - Day-of-month calendar grid (1st through 31st)
 * - Target wallet destination selector
 * - Synchronized background task & notification scheduling
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ordinalDay } from '../../utils/wallets';
import { useWallets } from '../../hooks/useWallets';
import { lightHaptic, mediumHaptic, heavyHaptic } from '../../services/haptics/hapticFeedback';
import type { Category } from '../../types/models';

export default function SalarySettingsScreen({ navigation }: any) {
  const { salarySettings, updateSalarySettings } = useSettingsStore();
  const { currentUser } = useAuthStore();
  const themeColors = useThemeColors();
  const { wallets } = useWallets();

  const [isEnabled, setIsEnabled] = useState(salarySettings.isEnabled);
  const [amount, setAmount] = useState(salarySettings.amount > 0 ? salarySettings.amount.toString() : '');
  const [selectedVault, setSelectedVault] = useState<string>(salarySettings.targetVault || 'main');
  const [payDay, setPayDay] = useState(salarySettings.payDay ?? 1);
  const [showPayDayPicker, setShowPayDayPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    if (wallets.length > 0 && !wallets.some((w) => w.id === selectedVault)) {
      setSelectedVault(wallets[0].id);
    }
  }, [wallets, selectedVault]);

  const handleSave = async () => {
    if (!isEnabled) {
      setIsSaving(true);
      updateSalarySettings({ isEnabled: false });
      const { cancelSalaryReminder } = await import('../../services/notifications/scheduleNudges');
      await cancelSalaryReminder();
      lightHaptic();
      setTimeout(() => {
        setIsSaving(false);
        navigation.goBack();
      }, 250);
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please specify a valid salary figure.');
      return;
    }

    setIsSaving(true);
    heavyHaptic();

    let categoryId = salarySettings.categoryId;
    if (!categoryId && currentUser) {
      try {
        const categoryRepo = new CategoryRepository();
        const incomeCategories = await categoryRepo.findByUserAndType(currentUser.id, 'income');
        const salaryCat =
          incomeCategories.find((c: Category) => c.name.toLowerCase() === 'salary') || incomeCategories[0];
        if (salaryCat) categoryId = salaryCat.id;
      } catch (err) {
        console.warn('[SalarySettings] Could not resolve salary category:', err);
      }
    }

    const { initializeAutoSalarySchedule } = await import('../../services/backgroundTasks/autoSalaryTask');
    const nextProcessing = initializeAutoSalarySchedule(payDay);

    updateSalarySettings({
      isEnabled,
      amount: numAmount,
      categoryId,
      targetVault: selectedVault as any,
      payDay,
      nextProcessing,
    });

    const { scheduleSalaryReminder } = await import('../../services/notifications/scheduleNudges');
    await scheduleSalaryReminder();

    setTimeout(() => {
      setIsSaving(false);
      navigation.goBack();
    }, 250);
  };

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
          <Text style={styles.headerSuper}>RECURRING ENGINE</Text>
          <Text style={styles.headerTitle}>AUTO-SALARY</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={[styles.statusText, isEnabled ? styles.statusActive : null]}>
            {isEnabled ? 'ENABLED' : 'PAUSED'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* CARD 1: MASTER RECURRING SWITCH */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>AUTOMATED INFLOW SCHEDULE</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Enable Auto-Salary</Text>
              <Text style={styles.rowDesc}>
                Automatically log income on the {ordinalDay(payDay)} of each month
              </Text>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={(val) => {
                lightHaptic();
                setIsEnabled(val);
              }}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>
        </View>

        {/* CARD 2: MONTHLY SALARY AMOUNT */}
        <View style={[styles.card, !isEnabled ? styles.cardMuted : null]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>NET MONTHLY AMOUNT</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.inputCaption}>Enter exact monthly credit amount:</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
                editable={isEnabled}
              />
            </View>
          </View>
        </View>

        {/* CARD 3: SCHEDULE DAY OF MONTH */}
        <View style={[styles.card, !isEnabled ? styles.cardMuted : null]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>PAYDAY CALENDAR CADENCE</Text>
          </View>
          <TouchableOpacity
            style={styles.daySelectorRow}
            onPress={() => {
              if (isEnabled) {
                lightHaptic();
                setShowPayDayPicker(true);
              }
            }}
            disabled={!isEnabled}
          >
            <View>
              <Text style={styles.rowLabel}>Credited on:</Text>
              <Text style={styles.selectedDayBig}>{ordinalDay(payDay)} of each month</Text>
            </View>
            <View style={styles.changeBadge}>
              <Text style={styles.changeBadgeText}>CHANGE DAY</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* CARD 4: DESTINATION WALLET */}
        <View style={[styles.card, !isEnabled ? styles.cardMuted : null]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>TARGET DESTINATION WALLET</Text>
          </View>
          <View style={styles.walletGrid}>
            {wallets.map((w) => {
              const isSelected = selectedVault === w.id;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.walletChip, isSelected ? styles.walletChipActive : null]}
                  onPress={() => {
                    if (isEnabled) {
                      lightHaptic();
                      setSelectedVault(w.id);
                    }
                  }}
                  disabled={!isEnabled}
                >
                  <Text style={[styles.walletChipText, isSelected ? styles.walletChipTextActive : null]}>
                    {w.name.toUpperCase()}
                  </Text>
                  <Text style={[styles.walletChipVault, isSelected ? styles.walletChipVaultActive : null]}>
                    {w.isDefault ? 'PRIMARY' : 'WALLET'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CARD 5: RECURRING AUDIT SUMMARY */}
        {isEnabled && (
          <View style={styles.summaryCard}>
            <Text style={styles.summarySuper}>LEDGER SCHEDULE NOTE</Text>
            <Text style={styles.summaryText}>
              On the {ordinalDay(payDay)} of each month, ZeroWallet will automatically append a{' '}
              {amount ? `$${amount}` : 'salary'} credit directly to your{' '}
              <Text style={styles.boldText}>
                {wallets.find((w) => w.id === selectedVault)?.name ?? 'Selected'}
              </Text>{' '}
              wallet.
            </Text>
          </View>
        )}

      </ScrollView>

      {/* FLOATING SAVE BUTTON */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving ? styles.buttonMuted : null]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color={themeColors.background} />
        ) : (
          <Text style={styles.saveButtonText}>SAVE SALARY CONFIGURATION</Text>
        )}
      </TouchableOpacity>

      {/* Payday Modal Calendar Grid */}
      <Modal
        visible={showPayDayPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayDayPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalSuper}>SCHEDULE SELECTION</Text>
              <Text style={styles.modalTitle}>SELECT DAY OF MONTH</Text>
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                const isSelected = payDay === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayCell, isSelected ? styles.dayCellActive : null]}
                    onPress={() => {
                      lightHaptic();
                      setPayDay(d);
                      setShowPayDayPicker(false);
                    }}
                  >
                    <Text style={[styles.dayCellText, isSelected ? styles.dayCellTextActive : null]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                lightHaptic();
                setShowPayDayPicker(false);
              }}
            >
              <Text style={styles.modalCloseText}>CLOSE</Text>
            </TouchableOpacity>
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
    statusPill: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 2,
    },
    statusText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    statusActive: {
      color: theme.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: 120,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    cardMuted: {
      opacity: 0.45,
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
    cardBody: {
      padding: spacing.md,
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
    inputCaption: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
      marginBottom: spacing.xs,
    },
    amountInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      borderRadius: 2,
      paddingHorizontal: spacing.md,
    },
    currencyPrefix: {
      ...typography.h3,
      color: theme.textSecondary,
      marginRight: spacing.xs,
      fontWeight: '600',
    },
    amountInput: {
      flex: 1,
      paddingVertical: spacing.sm,
      fontSize: 22,
      fontFamily: 'monospace',
      color: theme.text,
      fontWeight: '700',
    },
    daySelectorRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    selectedDayBig: {
      ...typography.h3,
      color: theme.text,
      fontWeight: '700',
      marginTop: 2,
    },
    changeBadge: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 2,
      backgroundColor: theme.background,
    },
    changeBadgeText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    walletGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: spacing.sm,
      gap: spacing.xs,
    },
    walletChip: {
      flex: 1,
      minWidth: '45%',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      padding: spacing.sm,
      backgroundColor: theme.background,
    },
    walletChipActive: {
      borderColor: theme.text,
      backgroundColor: theme.text,
    },
    walletChipText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.5,
    },
    walletChipTextActive: {
      color: theme.background,
    },
    walletChipVault: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      marginTop: 2,
    },
    walletChipVaultActive: {
      color: theme.background,
      opacity: 0.8,
    },
    summaryCard: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    summarySuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: '700',
      marginBottom: 4,
    },
    summaryText: {
      ...typography.body,
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    boldText: {
      color: theme.text,
      fontWeight: '700',
    },
    saveButton: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: Platform.OS === 'ios' ? 24 : 16,
      height: 52,
      borderWidth: 1,
      borderColor: theme.text,
      backgroundColor: theme.text,
      borderRadius: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      ...typography.caption,
      color: theme.background,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
    buttonMuted: {
      opacity: 0.5,
    },
    // Calendar modal
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
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      padding: spacing.lg,
    },
    modalHeader: {
      marginBottom: spacing.md,
    },
    modalSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
      marginBottom: 2,
    },
    modalTitle: {
      ...typography.h3,
      color: theme.text,
      fontWeight: '700',
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    dayCell: {
      width: 40,
      height: 40,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    dayCellActive: {
      borderColor: theme.text,
      backgroundColor: theme.text,
    },
    dayCellText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      fontSize: 12,
      fontFamily: 'monospace',
    },
    dayCellTextActive: {
      color: theme.background,
    },
    modalCloseBtn: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    modalCloseText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      letterSpacing: 1,
    },
  });
