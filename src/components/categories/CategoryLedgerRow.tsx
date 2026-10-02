/**
 * Purpose: Architectural Ledger Row for a Category with inline Budget Progress.
 * 
 * Adheres strictly to the Simplizum aesthetic:
 * - 1px razor-thin border
 * - 2-4px subtle corners
 * - Sharp typography with tabular figures
 * - Restrained 2px hairline gauge with color cues (monochrome/accent under 80%, amber 80-99%, crimson 100%+)
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import type { CategoryWithBudget } from '../../services/categoryBudgetService';

interface CategoryLedgerRowProps {
  item: CategoryWithBudget;
  currency: string;
  onPress: (item: CategoryWithBudget) => void;
}

export const CategoryLedgerRow = memo(function CategoryLedgerRow({
  item,
  currency,
  onPress,
}: CategoryLedgerRowProps) {
  const themeColors = useThemeColors();
  const { category, spendingThisMonth, transactionCount, budget, percentage, remaining, isWarning, isExceeded } = item;

  const handlePress = () => {
    triggerHaptic('selection');
    onPress(item);
  };

  const isExpense = category.type === 'expense';
  const hasBudget = Boolean(budget && budget.amount > 0);

  // Hairline progress gauge color per Simplizum rules:
  // Neutral/theme accent under 80%, Amber at 80-99%, Crimson if exceeded
  let gaugeColor = themeColors.accent;
  if (isExceeded) {
    gaugeColor = themeColors.error;
  } else if (isWarning) {
    gaugeColor = themeColors.warning;
  }

  const cappedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${category.name} category`}
    >
      {/* Upper Content Row */}
      <View style={styles.topRow}>
        {/* Left: Icon & Meta */}
        <View style={styles.leftCol}>
          <View
            style={[
              styles.iconBox,
              {
                borderColor: themeColors.borderSubtle,
                backgroundColor: `${category.color}15`,
              },
            ]}
          >
            <Icon name={category.icon || 'tag-outline'} size={18} color={category.color} />
          </View>

          <View style={styles.nameBlock}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.categoryName, { color: themeColors.text }]}
                numberOfLines={1}
              >
                {category.name}
              </Text>
              {category.isDefault && (
                <View
                  style={[
                    styles.tagBadge,
                    {
                      borderColor: themeColors.borderSubtle,
                      backgroundColor: themeColors.surfaceElevated,
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: themeColors.textMuted }]}>
                    SYSTEM
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.submetaText, { color: themeColors.textMuted }]}>
              {transactionCount === 1 ? '1 transaction' : `${transactionCount} transactions`}
            </Text>
          </View>
        </View>

        {/* Right: Spending & Budget Values */}
        <View style={styles.rightCol}>
          {isExpense ? (
            hasBudget ? (
              <View style={styles.budgetFiguresBlock}>
                <View style={styles.amountLine}>
                  <Text style={[styles.spentAmount, { color: themeColors.text }]}>
                    {formatCurrency(spendingThisMonth, currency)}
                  </Text>
                  <Text style={[styles.budgetTotal, { color: themeColors.textMuted }]}>
                    {' / '}{formatCurrency(budget!.amount, currency)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.statusSubtext,
                    {
                      color: isExceeded
                        ? themeColors.error
                        : isWarning
                        ? themeColors.warning
                        : themeColors.textSecondary,
                    },
                  ]}
                >
                  {isExceeded
                    ? `+${formatCurrency(spendingThisMonth - budget!.amount, currency)} over`
                    : `${formatCurrency(remaining, currency)} remaining`}
                </Text>
              </View>
            ) : (
              <View style={styles.unbudgetedBlock}>
                <Text style={[styles.spentAmount, { color: themeColors.text }]}>
                  {formatCurrency(spendingThisMonth, currency)}
                </Text>
                <View
                  style={[
                    styles.setBudgetPill,
                    { borderColor: themeColors.accent },
                  ]}
                >
                  <Text style={[styles.setBudgetText, { color: themeColors.accent }]}>
                    + SET BUDGET
                  </Text>
                </View>
              </View>
            )
          ) : (
            <View style={styles.incomeFiguresBlock}>
              <Text style={[styles.incomeAmount, { color: themeColors.success }]}>
                +{formatCurrency(spendingThisMonth, currency)}
              </Text>
              <Text style={[styles.statusSubtext, { color: themeColors.textMuted }]}>
                this month
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 2px Hairline Progress Bar for Budgeted Categories */}
      {isExpense && hasBudget && (
        <View style={styles.gaugeContainer}>
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
                  backgroundColor: gaugeColor,
                  width: `${cappedPercentage}%`,
                },
              ]}
            />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
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
  nameBlock: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: typography.weights.semiBold,
    letterSpacing: -0.2,
  },
  tagBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: borderRadius.none,
  },
  tagText: {
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
  budgetFiguresBlock: {
    alignItems: 'flex-end',
  },
  amountLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  spentAmount: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  budgetTotal: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
    fontVariant: ['tabular-nums'],
  },
  statusSubtext: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
    marginTop: 2,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  unbudgetedBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  setBudgetPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  setBudgetText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
  },
  incomeFiguresBlock: {
    alignItems: 'flex-end',
  },
  incomeAmount: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  gaugeContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.xs,
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
});
