/**
 * Purpose: Architectural Debt Card for obligations and receivables.
 * 
 * Aesthetic: Simplizum
 * - 1px razor hairline border
 * - 2-4px subtle corners
 * - Tabular figures with remaining balance calculation
 * - 2px hairline progress gauge
 * - Quick action duo: Log Payment & View Details
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import type { Debt } from '../../types/models';

interface DebtArchitecturalCardProps {
  debt: Debt;
  currency: string;
  onPaymentPress: (debt: Debt) => void;
  onPress: (debt: Debt) => void;
}

export const DebtArchitecturalCard = memo(function DebtArchitecturalCard({
  debt,
  currency,
  onPaymentPress,
  onPress,
}: DebtArchitecturalCardProps) {
  const themeColors = useThemeColors();

  const total = debt.amount || 0;
  const paid = debt.amountPaid || 0;
  const remaining = Math.max(0, total - paid);
  const percentage = total > 0 ? (paid / total) * 100 : 0;
  const cappedPercentage = Math.min(100, Math.max(0, percentage));

  const isBorrowed = debt.type === 'borrowed';
  const isPaid = debt.status === 'paid' || remaining === 0;
  const isOverdue = Boolean(debt.dueDate && debt.dueDate < Date.now() && !isPaid);

  // Format due date
  const dueDateStr = debt.dueDate
    ? new Date(debt.dueDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  // Status Badge styling
  let badgeText = 'PENDING';
  let badgeColor = themeColors.textMuted;
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

  const handleLogPayment = () => {
    triggerHaptic('selection');
    onPaymentPress(debt);
  };

  const handleCardPress = () => {
    triggerHaptic('selection');
    onPress(debt);
  };

  return (
    <TouchableOpacity
      style={[
        styles.cardContainer,
        {
          backgroundColor: themeColors.surface,
          borderColor: isOverdue ? themeColors.error : themeColors.border,
        },
      ]}
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          <View
            style={[
              styles.iconBox,
              {
                borderColor: themeColors.borderSubtle,
                backgroundColor: isBorrowed
                  ? `${themeColors.error}10`
                  : `${themeColors.success}10`,
              },
            ]}
          >
            <Icon
              name={isBorrowed ? 'arrow-top-right' : 'arrow-bottom-left'}
              size={18}
              color={isBorrowed ? themeColors.error : themeColors.success}
            />
          </View>

          <View style={styles.titleBlock}>
            <View style={styles.nameLine}>
              <Text
                style={[styles.personName, { color: themeColors.text }]}
                numberOfLines={1}
              >
                {debt.personName}
              </Text>
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

            <Text style={[styles.submetaText, { color: themeColors.textMuted }]}>
              {dueDateStr
                ? isOverdue
                  ? `Due: ${dueDateStr} (Overdue)`
                  : `Due: ${dueDateStr}`
                : isBorrowed
                ? 'Borrowed obligation'
                : 'Lent receivable'}
            </Text>
          </View>
        </View>

        {/* Remaining Amount */}
        <View style={styles.rightCol}>
          <Text
            style={[
              styles.remainingAmount,
              {
                color: isPaid
                  ? themeColors.textMuted
                  : isBorrowed
                  ? themeColors.error
                  : themeColors.success,
              },
            ]}
          >
            {isPaid ? 'PAID' : formatCurrency(remaining, currency)}
          </Text>
          <Text style={[styles.remainingSubtext, { color: themeColors.textMuted }]}>
            {isPaid ? 'Closed' : 'outstanding'}
          </Text>
        </View>
      </View>

      {/* Description / Note if present */}
      {Boolean(debt.description) && (
        <Text
          style={[styles.descriptionText, { color: themeColors.textSecondary }]}
          numberOfLines={1}
        >
          {debt.description}
        </Text>
      )}

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
                backgroundColor: isPaid
                  ? themeColors.success
                  : isBorrowed
                  ? themeColors.accent
                  : themeColors.success,
                width: `${cappedPercentage}%`,
              },
            ]}
          />
        </View>

        <View style={styles.gaugeFooter}>
          <Text style={[styles.gaugeFooterText, { color: themeColors.textMuted }]}>
            {formatCurrency(paid, currency)} paid of {formatCurrency(total, currency)}
          </Text>
          <Text style={[styles.gaugeFooterText, { color: themeColors.textMuted }]}>
            {Math.round(percentage)}%
          </Text>
        </View>
      </View>

      {/* Action Footer */}
      {!isPaid && (
        <View style={[styles.actionRow, { borderTopColor: themeColors.borderSubtle }]}>
          <TouchableOpacity
            style={[
              styles.paymentButton,
              {
                backgroundColor: themeColors.surfaceElevated,
                borderColor: themeColors.border,
              },
            ]}
            onPress={handleLogPayment}
            activeOpacity={0.7}
          >
            <Icon
              name={isBorrowed ? 'cash-minus' : 'cash-plus'}
              size={14}
              color={themeColors.text}
            />
            <Text style={[styles.paymentButtonText, { color: themeColors.text }]}>
              {isBorrowed ? 'LOG REPAYMENT' : 'RECORD SETTLEMENT'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  titleBlock: {
    flex: 1,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  personName: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: borderRadius.none,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  submetaText: {
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  remainingAmount: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  remainingSubtext: {
    fontSize: 9,
    marginTop: 2,
  },
  descriptionText: {
    fontSize: 11,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  gaugeBlock: {
    marginTop: spacing.md,
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
  actionRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  paymentButtonText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
});
