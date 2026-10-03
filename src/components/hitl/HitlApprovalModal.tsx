/**
 * HitlApprovalModal — Human-In-The-Loop Recurring Confirmation Modal
 *
 * Simplizum Architectural Edition:
 * - 1px razor hairline borders
 * - 2px corner radius
 * - Monospace category tags and figures
 * - Interactive 3-way triage: Accept, Cancel for this sprint, or Delay (custom XX unit)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useHitlStore } from '../../store/hitlStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic, mediumHaptic, heavyHaptic } from '../../services/haptics/hapticFeedback';
import { formatCurrency } from '../../utils/currencyFormatter';
import {
  acceptHitlItem,
  cancelHitlItem,
  delayHitlItem,
  formatDelayPreview,
} from '../../services/hitl/hitlService';
import type { DelayUnit } from '../../types/hitl';

const DELAY_UNITS: { label: string; unit: DelayUnit }[] = [
  { label: 'MINUTES', unit: 'minutes' },
  { label: 'DAYS', unit: 'days' },
  { label: 'WEEKS', unit: 'weeks' },
  { label: 'MONTHS', unit: 'months' },
  { label: 'YEARS', unit: 'years' },
];

const QUICK_PRESETS: { label: string; value: number; unit: DelayUnit }[] = [
  { label: '15m', value: 15, unit: 'minutes' },
  { label: '1h', value: 60, unit: 'minutes' },
  { label: '1d', value: 1, unit: 'days' },
  { label: '1w', value: 1, unit: 'weeks' },
  { label: '1mo', value: 1, unit: 'months' },
];

export const HitlApprovalModal: React.FC = () => {
  const { pendingItems, isOpen, closeDialog } = useHitlStore();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [isDelaying, setIsDelaying] = useState(false);
  const [delayValue, setDelayValue] = useState('1');
  const [delayUnit, setDelayUnit] = useState<DelayUnit>('days');
  const [isProcessing, setIsProcessing] = useState(false);

  const currentItem = pendingItems[0];

  const handleAccept = useCallback(async () => {
    if (!currentItem || isProcessing) return;
    setIsProcessing(true);
    heavyHaptic();
    try {
      await acceptHitlItem(currentItem);
    } catch (err) {
      console.error('[HitlModal] Accept failed:', err);
    } finally {
      setIsProcessing(false);
      setIsDelaying(false);
    }
  }, [currentItem, isProcessing]);

  const handleCancelThisTime = useCallback(async () => {
    if (!currentItem || isProcessing) return;
    setIsProcessing(true);
    lightHaptic();
    try {
      await cancelHitlItem(currentItem);
    } catch (err) {
      console.error('[HitlModal] Cancel failed:', err);
    } finally {
      setIsProcessing(false);
      setIsDelaying(false);
    }
  }, [currentItem, isProcessing]);

  const handleConfirmDelay = useCallback(async () => {
    if (!currentItem || isProcessing) return;
    const num = parseFloat(delayValue);
    if (isNaN(num) || num <= 0) return;

    setIsProcessing(true);
    mediumHaptic();
    try {
      await delayHitlItem(currentItem, num, delayUnit);
    } catch (err) {
      console.error('[HitlModal] Delay failed:', err);
    } finally {
      setIsProcessing(false);
      setIsDelaying(false);
    }
  }, [currentItem, delayValue, delayUnit, isProcessing]);

  const handleDecideLater = useCallback(() => {
    lightHaptic();
    setIsDelaying(false);
    closeDialog();
  }, [closeDialog]);

  if (!isOpen || !currentItem) {
    return null;
  }

  const numericDelay = Math.max(1, parseFloat(delayValue) || 1);
  const formattedAmount = formatCurrency(currentItem.amount, currentItem.currency);
  const totalInQueue = pendingItems.length;

  const itemBadgeLabel =
    currentItem.type === 'salary'
      ? 'AUTO-SALARY'
      : currentItem.type === 'subscription'
      ? 'SUBSCRIPTION'
      : 'RECURRING EXPENSE';

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleDecideLater}>
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.superTag}>HITL APPROVAL QUEUE</Text>
              <Text style={styles.title}>
                {isDelaying ? 'POSTPONE COMMITMENT' : 'COMMITMENT DUE'}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {totalInQueue > 1 && (
                <View style={styles.counterBadge}>
                  <Text style={styles.counterText}>1 OF {totalInQueue}</Text>
                </View>
              )}
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{itemBadgeLabel}</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {/* Transaction Overview Card */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryTopRow}>
                <Text style={styles.itemName}>{currentItem.name}</Text>
                <Text style={styles.itemAmount}>{formattedAmount}</Text>
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <MaterialCommunityIcons name="wallet-outline" size={12} color={themeColors.textSecondary} />
                  <Text style={styles.metaChipText}>
                    {currentItem.walletName || currentItem.vaultType.toUpperCase()}
                  </Text>
                </View>
                {currentItem.categoryName && (
                  <View style={styles.metaChip}>
                    <MaterialCommunityIcons name="tag-outline" size={12} color={themeColors.textSecondary} />
                    <Text style={styles.metaChipText}>{currentItem.categoryName}</Text>
                  </View>
                )}
              </View>
              <View style={styles.dueDateRow}>
                <MaterialCommunityIcons name="calendar-clock" size={12} color={themeColors.textSecondary} />
                <Text style={styles.dueDateText}>
                  Scheduled: {currentItem.dateDescription} ({currentItem.frequencyDescription})
                </Text>
              </View>
            </View>

            {/* View 1: Main Triage Actions */}
            {!isDelaying ? (
              <View style={styles.actionsSection}>
                <Text style={styles.instructionsText}>
                  Confirm this transaction, skip for this sprint, or postpone to a custom time:
                </Text>

                {/* Option 1: Accept Transaction */}
                <TouchableOpacity
                  style={[styles.primaryButton, isProcessing ? styles.disabledBtn : null]}
                  onPress={handleAccept}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={themeColors.background} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>ACCEPT & PROCESS NOW</Text>
                      <Text style={styles.buttonSubText}>
                        Log transaction & advance to next cycle
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Option 2: Cancel For This Sprint */}
                <TouchableOpacity
                  style={[styles.secondaryButton, isProcessing ? styles.disabledBtn : null]}
                  onPress={handleCancelThisTime}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryButtonText}>CANCEL FOR THIS SPRINT</Text>
                  <Text style={styles.secondaryButtonSubText}>
                    Skip this occurrence; no money deducted or credited
                  </Text>
                </TouchableOpacity>

                {/* Option 3: Delay with Custom Input */}
                <TouchableOpacity
                  style={[styles.outlineButton, isProcessing ? styles.disabledBtn : null]}
                  onPress={() => {
                    mediumHaptic();
                    setIsDelaying(true);
                  }}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <View style={styles.outlineButtonRow}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={themeColors.text} />
                    <Text style={styles.outlineButtonText}>DELAY WITH CUSTOM TIME...</Text>
                  </View>
                  <Text style={styles.secondaryButtonSubText}>
                    Postpone by minutes, days, weeks, months, or years
                  </Text>
                </TouchableOpacity>

                {/* Decide Later */}
                <TouchableOpacity
                  style={styles.decideLaterBtn}
                  onPress={handleDecideLater}
                  disabled={isProcessing}
                >
                  <Text style={styles.decideLaterText}>DECIDE LATER (CLOSE)</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* View 2: Custom Delay Input Sub-screen */
              <View style={styles.delaySection}>
                <Text style={styles.delayInstruction}>
                  Enter delay duration (XX) and choose the time unit:
                </Text>

                {/* Numeric input & unit chips */}
                <View style={styles.delayInputContainer}>
                  <TextInput
                    style={styles.delayTextInput}
                    value={delayValue}
                    onChangeText={setDelayValue}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="1"
                    placeholderTextColor={themeColors.textSecondary}
                  />
                  <Text style={styles.delayInputUnitLabel}>{delayUnit.toUpperCase()}</Text>
                </View>

                {/* Unit Selector Chips */}
                <View style={styles.unitChipsRow}>
                  {DELAY_UNITS.map(({ label, unit }) => {
                    const isSelected = delayUnit === unit;
                    return (
                      <TouchableOpacity
                        key={unit}
                        style={[styles.unitChip, isSelected ? styles.unitChipActive : null]}
                        onPress={() => {
                          lightHaptic();
                          setDelayUnit(unit);
                        }}
                      >
                        <Text style={[styles.unitChipText, isSelected ? styles.unitChipTextActive : null]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Quick Preset Shortcuts */}
                <Text style={styles.presetLabel}>QUICK PRESETS:</Text>
                <View style={styles.presetsRow}>
                  {QUICK_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      style={styles.presetChip}
                      onPress={() => {
                        lightHaptic();
                        setDelayValue(preset.value.toString());
                        setDelayUnit(preset.unit);
                      }}
                    >
                      <Text style={styles.presetChipText}>{preset.label.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Live Preview Badge */}
                <View style={styles.previewBox}>
                  <MaterialCommunityIcons name="clock-check-outline" size={14} color={themeColors.text} />
                  <Text style={styles.previewText}>
                    Prompt again on: {formatDelayPreview(numericDelay, delayUnit)}
                  </Text>
                </View>

                {/* Split Action Deck */}
                <View style={styles.splitDeck}>
                  <TouchableOpacity
                    style={styles.splitBackBtn}
                    onPress={() => {
                      lightHaptic();
                      setIsDelaying(false);
                    }}
                    disabled={isProcessing}
                  >
                    <Text style={styles.splitBackText}>BACK</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.splitConfirmBtn, isProcessing ? styles.disabledBtn : null]}
                    onPress={handleConfirmDelay}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={themeColors.background} />
                    ) : (
                      <Text style={styles.splitConfirmText}>CONFIRM DELAY</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.78)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.md,
    },
    dialogCard: {
      width: '100%',
      maxWidth: 440,
      maxHeight: '90%',
      backgroundColor: theme.card || theme.surface || theme.background,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
    },
    headerLeft: {
      flex: 1,
    },
    superTag: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
      marginBottom: 2,
    },
    title: {
      ...typography.h3,
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    counterBadge: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.background,
    },
    counterText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      fontFamily: 'monospace',
      fontWeight: '700',
    },
    typeBadge: {
      borderWidth: 1,
      borderColor: theme.text,
      borderRadius: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.text,
    },
    typeBadgeText: {
      ...typography.caption,
      color: theme.background,
      fontSize: 9,
      letterSpacing: 0.8,
      fontWeight: '700',
    },
    bodyScroll: {
      maxHeight: 520,
    },
    bodyContent: {
      padding: spacing.md,
    },
    summaryBox: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      padding: spacing.md,
      backgroundColor: theme.background,
      marginBottom: spacing.md,
    },
    summaryTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    itemName: {
      ...typography.body,
      color: theme.text,
      fontWeight: '700',
      fontSize: 15,
      flex: 1,
      marginRight: spacing.sm,
    },
    itemAmount: {
      ...typography.h3,
      color: theme.text,
      fontFamily: 'monospace',
      fontWeight: '700',
      fontSize: 16,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.card || theme.surface,
    },
    metaChipText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    dueDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    dueDateText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
    },
    instructionsText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 12,
      marginBottom: spacing.md,
      lineHeight: 16,
    },
    actionsSection: {
      gap: spacing.sm,
    },
    primaryButton: {
      backgroundColor: theme.text,
      borderWidth: 1,
      borderColor: theme.text,
      borderRadius: 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      ...typography.caption,
      color: theme.background,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
    },
    buttonSubText: {
      ...typography.caption,
      color: theme.background,
      fontSize: 10,
      opacity: 0.8,
      marginTop: 2,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      borderRadius: 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
    },
    secondaryButtonSubText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      marginTop: 2,
    },
    outlineButton: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    outlineButtonText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    decideLaterBtn: {
      alignItems: 'center',
      paddingVertical: spacing.xs,
      marginTop: 4,
    },
    decideLaterText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
    },
    disabledBtn: {
      opacity: 0.5,
    },
    // Delay Sub-View Styles
    delaySection: {
      gap: spacing.sm,
    },
    delayInstruction: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    delayInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      backgroundColor: theme.background,
      paddingHorizontal: spacing.md,
    },
    delayTextInput: {
      flex: 1,
      fontSize: 22,
      fontFamily: 'monospace',
      color: theme.text,
      fontWeight: '700',
      paddingVertical: spacing.sm,
    },
    delayInputUnitLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'monospace',
    },
    unitChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    unitChip: {
      flex: 1,
      minWidth: '28%',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingVertical: spacing.xs,
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    unitChipActive: {
      borderColor: theme.text,
      backgroundColor: theme.text,
    },
    unitChipText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontFamily: 'monospace',
      fontWeight: '700',
    },
    unitChipTextActive: {
      color: theme.background,
    },
    presetLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: '700',
      marginTop: 4,
    },
    presetsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    presetChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingVertical: 6,
      alignItems: 'center',
      backgroundColor: theme.card || theme.surface,
    },
    presetChipText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 10,
      fontFamily: 'monospace',
      fontWeight: '700',
    },
    previewBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      backgroundColor: theme.background,
      padding: spacing.sm,
      marginTop: 4,
    },
    previewText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
    },
    splitDeck: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    splitBackBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    splitBackText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 1,
    },
    splitConfirmBtn: {
      flex: 1,
      backgroundColor: theme.text,
      borderWidth: 1,
      borderColor: theme.text,
      borderRadius: 2,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    splitConfirmText: {
      ...typography.caption,
      color: theme.background,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 1,
    },
  });
