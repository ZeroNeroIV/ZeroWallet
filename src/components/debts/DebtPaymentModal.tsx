/**
 * Purpose: Fast Simplizum Modal for logging a Debt repayment or collection.
 * 
 * Supports:
 * - Direct Wallet debit/credit selection
 * - Full-settlement one-tap shortcut
 * - Derived ledger transaction recording
 */

import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency, getCurrencySymbol } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import type { Debt, Wallet } from '../../types/models';

interface WalletWithDerivedBalance extends Wallet {
  derivedBalance: number;
}

interface DebtPaymentModalProps {
  visible: boolean;
  debt: Debt | null;
  currency: string;
  accountId: string;
  onClose: () => void;
  onConfirmPayment: (params: {
    debtId: string;
    walletId?: string;
    amount: number;
  }) => Promise<void>;
}

export const DebtPaymentModal = memo(function DebtPaymentModal({
  visible,
  debt,
  currency,
  accountId,
  onClose,
  onConfirmPayment,
}: DebtPaymentModalProps) {
  const themeColors = useThemeColors();
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [wallets, setWallets] = useState<WalletWithDerivedBalance[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && accountId) {
      loadWallets();
      setPaymentAmount('');
    }
  }, [visible, accountId]);

  const loadWallets = async () => {
    try {
      const walletRepo = new WalletRepository();
      const [walletList, derivedBalances] = await Promise.all([
        walletRepo.findByAccount(accountId),
        walletRepo.getDerivedBalances(accountId),
      ]);
      const list: WalletWithDerivedBalance[] = walletList.map((w) => ({
        ...w,
        derivedBalance: derivedBalances[w.id] ?? 0,
      }));
      setWallets(list);
      if (list.length > 0) {
        setSelectedWalletId(list[0].id);
      }
    } catch (err) {
      console.error('[DebtPaymentModal] Failed to load wallets:', err);
    }
  };

  if (!debt) return null;

  const total = debt.amount || 0;
  const paid = debt.amountPaid || 0;
  const remaining = Math.max(0, total - paid);
  const isBorrowed = debt.type === 'borrowed';

  const handleQuickAdd = (delta: number) => {
    triggerHaptic('impactLight');
    const cur = parseFloat(paymentAmount) || 0;
    setPaymentAmount((cur + delta).toString());
  };

  const handleFullPayoff = () => {
    triggerHaptic('impactMedium');
    setPaymentAmount(remaining.toString());
  };

  const handleConfirm = async () => {
    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a payment amount greater than 0');
      return;
    }

    if (parsedAmount > remaining) {
      Alert.alert('Amount Warning', `This payment exceeds the remaining balance of ${formatCurrency(remaining, currency)}. Are you sure?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', onPress: () => processPayment(parsedAmount) },
      ]);
      return;
    }

    await processPayment(parsedAmount);
  };

  const processPayment = async (amount: number) => {
    try {
      setIsSubmitting(true);
      triggerHaptic('notificationSuccess');
      await onConfirmPayment({
        debtId: debt.id,
        walletId: selectedWalletId,
        amount,
      });
      onClose();
    } catch (err: any) {
      console.error('[DebtPaymentModal] Payment failed:', err);
      Alert.alert('Payment Error', err?.message || 'Failed to log debt payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerBar, { borderBottomColor: themeColors.borderSubtle }]}>
            <View>
              <Text style={[styles.headerSubtitle, { color: themeColors.textMuted }]}>
                {isBorrowed ? 'SETTLE REPAYMENT' : 'RECEIVE SETTLEMENT'}
              </Text>
              <Text style={[styles.headerTitle, { color: themeColors.text }]}>
                {debt.personName}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { borderColor: themeColors.borderSubtle }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={18} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Obligation Overview Card */}
            <View
              style={[
                styles.overviewCard,
                {
                  backgroundColor: themeColors.surfaceElevated,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <View style={styles.overviewCol}>
                <Text style={[styles.metaLabel, { color: themeColors.textMuted }]}>
                  ALREADY PAID
                </Text>
                <Text style={[styles.metaValue, { color: themeColors.textSecondary }]}>
                  {formatCurrency(paid, currency)}
                </Text>
              </View>

              <View
                style={[
                  styles.metaDivider,
                  { backgroundColor: themeColors.borderSubtle },
                ]}
              />

              <View style={styles.overviewCol}>
                <Text style={[styles.metaLabel, { color: themeColors.textMuted }]}>
                  TOTAL OBLIGATION
                </Text>
                <Text style={[styles.metaValue, { color: themeColors.text }]}>
                  {formatCurrency(total, currency)}
                </Text>
              </View>

              <View
                style={[
                  styles.metaDivider,
                  { backgroundColor: themeColors.borderSubtle },
                ]}
              />

              <View style={styles.overviewCol}>
                <Text style={[styles.metaLabel, { color: themeColors.textMuted }]}>
                  OUTSTANDING
                </Text>
                <Text
                  style={[
                    styles.metaValue,
                    { color: isBorrowed ? themeColors.error : themeColors.success },
                  ]}
                >
                  {formatCurrency(remaining, currency)}
                </Text>
              </View>
            </View>

            {/* Payment Amount Input */}
            <View style={styles.inputSection}>
              <Text style={[styles.sectionHeading, { color: themeColors.textSecondary }]}>
                PAYMENT AMOUNT ({currency})
              </Text>
              <View
                style={[
                  styles.amountInputRow,
                  {
                    backgroundColor: themeColors.surfaceElevated,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Text style={[styles.currencyPrefix, { color: themeColors.textMuted }]}>
                  {currencySymbol}
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: themeColors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  autoFocus={true}
                />
              </View>

              {/* Quick Increment Chips */}
              <View style={styles.quickChipsRow}>
                {[50, 100, 200].map((inc) => (
                  <TouchableOpacity
                    key={inc}
                    style={[
                      styles.chipButton,
                      {
                        borderColor: themeColors.borderSubtle,
                        backgroundColor: themeColors.surfaceElevated,
                      },
                    ]}
                    onPress={() => handleQuickAdd(inc)}
                  >
                    <Text style={[styles.chipText, { color: themeColors.textSecondary }]}>
                      +{currencySymbol}{inc}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[
                    styles.chipButton,
                    styles.fillChip,
                    {
                      borderColor: themeColors.accent,
                      backgroundColor: `${themeColors.accent}15`,
                    },
                  ]}
                  onPress={handleFullPayoff}
                >
                  <Text style={[styles.chipText, { color: themeColors.accent }]}>
                    FULL SETTLEMENT ({formatCurrency(remaining, currency)})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Wallet Debit/Credit Selection */}
            {wallets.length > 0 && (
              <View style={styles.walletSection}>
                <Text style={[styles.sectionHeading, { color: themeColors.textSecondary }]}>
                  {isBorrowed ? 'PAY FROM WALLET' : 'DEPOSIT INTO WALLET'}
                </Text>

                <View style={styles.walletsList}>
                  {wallets.map((w) => {
                    const isSelected = w.id === selectedWalletId;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[
                          styles.walletRow,
                          {
                            borderColor: isSelected ? themeColors.text : themeColors.border,
                            backgroundColor: isSelected
                              ? themeColors.surfaceElevated
                              : 'transparent',
                          },
                        ]}
                        onPress={() => {
                          triggerHaptic('selection');
                          setSelectedWalletId(w.id);
                        }}
                      >
                        <View style={styles.walletLeft}>
                          <Icon
                            name={isSelected ? 'check-circle' : 'circle-outline'}
                            size={16}
                            color={isSelected ? themeColors.text : themeColors.textMuted}
                          />
                          <Text style={[styles.walletName, { color: themeColors.text }]}>
                            {w.name}
                          </Text>
                        </View>

                        <Text style={[styles.walletBalance, { color: themeColors.textSecondary }]}>
                          {formatCurrency(w.derivedBalance, currency)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Bar */}
          <View style={[styles.footerBar, { borderTopColor: themeColors.borderSubtle }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: themeColors.border }]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>
                CANCEL
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: themeColors.text }]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              <Text style={[styles.confirmButtonText, { color: themeColors.background }]}>
                {isSubmitting ? 'PROCESSING...' : 'RECORD PAYMENT'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '85%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.sm,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  overviewCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: spacing.md,
    alignItems: 'center',
  },
  overviewCol: {
    flex: 1,
    alignItems: 'center',
  },
  metaDivider: {
    width: 1,
    height: 28,
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  inputSection: {
    gap: spacing.xs,
  },
  sectionHeading: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.md,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chipButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  fillChip: {
    flexGrow: 1,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  walletSection: {
    gap: spacing.xs,
  },
  walletsList: {
    gap: spacing.xs,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  walletName: {
    fontSize: 13,
    fontWeight: typography.weights.medium,
  },
  walletBalance: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  footerBar: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  confirmButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
});
