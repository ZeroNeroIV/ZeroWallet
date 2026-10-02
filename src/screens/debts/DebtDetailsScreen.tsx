/**
 * Purpose: Full-screen Simplizum Debt Details & Management Screen.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../store/authStore';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { DebtRepository } from '../../database/repositories/DebtRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { GoalsDebtsService } from '../../services/goalsDebtsService';
import { DebtPaymentModal } from '../../components/debts/DebtPaymentModal';
import type { Debt } from '../../types/models';

type NavigationProp = StackNavigationProp<MainStackParamList, 'DebtDetails'>;
type ScreenRouteProp = RouteProp<MainStackParamList, 'DebtDetails'>;

export default function DebtDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const debtId = route.params.debtId;

  const [debt, setDebt] = useState<Debt | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  const service = useMemo(() => new GoalsDebtsService(), []);

  const loadDebt = useCallback(async () => {
    try {
      setLoading(true);
      const debtRepo = new DebtRepository();
      const d = await debtRepo.findById(debtId);
      if (d) {
        setDebt(d);
        const accRepo = new AccountRepository();
        const acc = await accRepo.findById(d.accountId);
        if (acc?.currency) setCurrency(acc.currency);
      } else {
        Alert.alert('Error', 'Debt record not found');
        navigation.goBack();
      }
    } catch (err) {
      console.error('[DebtDetails] Failed to load debt:', err);
    } finally {
      setLoading(false);
    }
  }, [debtId, navigation]);

  useEffect(() => {
    loadDebt();
  }, [loadDebt]);

  useFocusEffect(
    useCallback(() => {
      loadDebt();
    }, [loadDebt])
  );

  if (!debt) return null;

  const total = debt.amount || 0;
  const paid = debt.amountPaid || 0;
  const remaining = Math.max(0, total - paid);
  const percentage = total > 0 ? (paid / total) * 100 : 0;
  const cappedPercentage = Math.min(100, Math.max(0, percentage));

  const isBorrowed = debt.type === 'borrowed';
  const isPaid = debt.status === 'paid' || remaining === 0;
  const isOverdue = debt.dueDate ? debt.dueDate < Date.now() && !isPaid : false;

  let badgeColor = themeColors.textMuted;
  let badgeText = 'PENDING';
  if (isPaid) {
    badgeText = 'SETTLED';
    badgeColor = themeColors.success;
  } else if (isOverdue) {
    badgeText = 'OVERDUE';
    badgeColor = themeColors.error;
  } else if (debt.status === 'partial') {
    badgeText = 'PARTIAL';
    badgeColor = themeColors.warning;
  }

  const handleConfirmPayment = async (params: {
    debtId: string;
    walletId?: string;
    amount: number;
  }) => {
    if (!currentUser) return;
    await service.recordDebtPayment({
      ...params,
      accountId: debt.accountId,
      userId: currentUser.id,
    });
    await loadDebt();
  };

  const handleMarkAsPaid = async () => {
    Alert.alert(
      'Mark as Paid',
      'This will mark the full obligation as settled without logging a wallet transaction. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              triggerHaptic('notificationSuccess');
              const debtRepo = new DebtRepository();
              await debtRepo.markAsPaid(debt.id);
              await loadDebt();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to mark as paid');
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Record',
      `Delete debt record for "${debt.personName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('notificationWarning');
              const debtRepo = new DebtRepository();
              await debtRepo.delete(debt.id);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete record');
            }
          },
        },
      ]
    );
  };

  const dueDateFormatted = debt.dueDate
    ? new Date(debt.dueDate).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No due date specified';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={themeColors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
      />

      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: themeColors.borderSubtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerNavButton, { borderColor: themeColors.borderSubtle }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={18} color={themeColors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerSubtitle, { color: themeColors.textMuted }]}>
            SPECIFICATIONS & TIMELINE
          </Text>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            {debt.personName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('EditDebt', { debtId: debt.id })}
          style={[styles.editButton, { borderColor: themeColors.borderSubtle }]}
        >
          <Icon name="pencil-outline" size={16} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Balance Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: isOverdue ? themeColors.error : themeColors.border,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTypeRow}>
              <Icon
                name={isBorrowed ? 'arrow-top-right' : 'arrow-bottom-left'}
                size={14}
                color={isBorrowed ? themeColors.error : themeColors.success}
              />
              <Text
                style={[
                  styles.heroTypeLabel,
                  { color: isBorrowed ? themeColors.error : themeColors.success },
                ]}
              >
                {isBorrowed ? 'BORROWED OBLIGATION' : 'RECEIVABLE ASSET'}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  borderColor: badgeColor,
                  backgroundColor: `${badgeColor}15`,
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                {badgeText}
              </Text>
            </View>
          </View>

          <Text style={[styles.heroAmountLabel, { color: themeColors.textMuted }]}>
            {isPaid ? 'TOTAL SETTLED' : 'OUTSTANDING BALANCE'}
          </Text>
          <Text
            style={[
              styles.heroAmountValue,
              {
                color: isPaid
                  ? themeColors.textMuted
                  : isBorrowed
                  ? themeColors.error
                  : themeColors.success,
              },
            ]}
          >
            {isPaid ? formatCurrency(total, currency) : formatCurrency(remaining, currency)}
          </Text>

          {/* 2px Hairline Progress Bar */}
          <View style={styles.gaugeBlock}>
            <View
              style={[
                styles.gaugeTrack,
                { backgroundColor: themeColors.borderSubtle },
              ]}
            >
              <View
                style={[
                  styles.gaugeFill,
                  {
                    backgroundColor: isPaid ? themeColors.success : themeColors.accent,
                    width: `${cappedPercentage}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.gaugeFooter}>
              <Text style={[styles.gaugeFooterText, { color: themeColors.textMuted }]}>
                {Math.round(percentage)}% amortized
              </Text>
              <Text style={[styles.gaugeFooterText, { color: themeColors.textMuted }]}>
                {formatCurrency(paid, currency)} / {formatCurrency(total, currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Architectural Specs Table */}
        <View
          style={[
            styles.specsTable,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
        >
          <Text style={[styles.tableHeading, { color: themeColors.textMuted }]}>
            OBLIGATION SPECIFICATIONS
          </Text>

          <View style={[styles.tableRow, { borderBottomColor: themeColors.borderSubtle }]}>
            <Text style={[styles.specLabel, { color: themeColors.textSecondary }]}>
              Counterparty
            </Text>
            <Text style={[styles.specValue, { color: themeColors.text }]}>
              {debt.personName}
            </Text>
          </View>

          <View style={[styles.tableRow, { borderBottomColor: themeColors.borderSubtle }]}>
            <Text style={[styles.specLabel, { color: themeColors.textSecondary }]}>
              Principal Amount
            </Text>
            <Text style={[styles.specValue, { color: themeColors.text }]}>
              {formatCurrency(total, currency)}
            </Text>
          </View>

          <View style={[styles.tableRow, { borderBottomColor: themeColors.borderSubtle }]}>
            <Text style={[styles.specLabel, { color: themeColors.textSecondary }]}>
              Total Paid
            </Text>
            <Text style={[styles.specValue, { color: themeColors.text }]}>
              {formatCurrency(paid, currency)}
            </Text>
          </View>

          <View style={[styles.tableRow, { borderBottomColor: themeColors.borderSubtle }]}>
            <Text style={[styles.specLabel, { color: themeColors.textSecondary }]}>
              Due Date
            </Text>
            <Text
              style={[
                styles.specValue,
                { color: isOverdue ? themeColors.error : themeColors.text },
              ]}
            >
              {dueDateFormatted}
            </Text>
          </View>

          {Boolean(debt.description) && (
            <View style={styles.tableRow}>
              <Text style={[styles.specLabel, { color: themeColors.textSecondary }]}>
                Notes & Memo
              </Text>
              <Text style={[styles.specValue, { color: themeColors.text }]}>
                {debt.description}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {!isPaid && (
          <View style={styles.actionBlock}>
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: themeColors.text }]}
              onPress={() => setPaymentModalVisible(true)}
            >
              <Icon
                name={isBorrowed ? 'cash-minus' : 'cash-plus'}
                size={16}
                color={themeColors.background}
              />
              <Text style={[styles.primaryActionText, { color: themeColors.background }]}>
                {isBorrowed ? 'LOG REPAYMENT' : 'RECORD SETTLEMENT'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryAction,
                { borderColor: themeColors.border, backgroundColor: themeColors.surface },
              ]}
              onPress={handleMarkAsPaid}
            >
              <Text style={[styles.secondaryActionText, { color: themeColors.text }]}>
                MARK AS FULLY SETTLED
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delete Record */}
        <TouchableOpacity
          style={[
            styles.deleteButton,
            { borderColor: themeColors.error, backgroundColor: `${themeColors.error}10` },
          ]}
          onPress={handleDelete}
        >
          <Icon name="trash-can-outline" size={16} color={themeColors.error} />
          <Text style={[styles.deleteButtonText, { color: themeColors.error }]}>
            DELETE DEBT RECORD
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Payment Modal */}
      <DebtPaymentModal
        visible={paymentModalVisible}
        debt={debt}
        currency={currency}
        accountId={debt.accountId}
        onClose={() => setPaymentModalVisible(false)}
        onConfirmPayment={handleConfirmPayment}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerNavButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: spacing.md,
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
    marginTop: 1,
  },
  editButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroTypeLabel: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  statusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: borderRadius.none,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  heroAmountLabel: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    marginTop: spacing.xs,
  },
  heroAmountValue: {
    fontSize: 28,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    marginTop: 2,
  },
  gaugeBlock: {
    marginTop: spacing.lg,
    gap: 4,
  },
  gaugeTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    width: '100%',
  },
  gaugeFill: {
    height: 2,
    borderRadius: 1,
  },
  gaugeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeFooterText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  specsTable: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  tableHeading: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  specLabel: {
    fontSize: 12,
  },
  specValue: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  actionBlock: {
    gap: spacing.sm,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xs,
  },
  primaryActionText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  secondaryAction: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  secondaryActionText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  deleteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  deleteButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
});
