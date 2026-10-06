/**
 * Purpose: Architectural Goal Card with 2px hairline gauge and direct action duo.
 * 
 * Aesthetic: Simplizum
 * - 1px razor hairline border
 * - 2-4px subtle corners
 * - Tabular figures for target and current amounts
 * - 2px hairline gauge with restrained color cues
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { useUIStore } from '../../store/uiStore';
import type { Goal } from '../../types/models';

interface GoalArchitecturalCardProps {
  goal: Goal;
  currency: string;
  onFundPress: (goal: Goal) => void;
  onEditPress: (goal: Goal) => void;
}

export const GoalArchitecturalCard = memo(function GoalArchitecturalCard({
  goal,
  currency,
  onFundPress,
  onEditPress,
}: GoalArchitecturalCardProps) {
  const themeColors = useThemeColors();
  const isBalanceHidden = useUIStore((s) => s.isBalanceHidden);

  const target = goal.targetAmount || 0;
  const current = goal.currentAmount || 0;
  const percentage = target > 0 ? (current / target) * 100 : 0;
  const cappedPercentage = Math.min(100, Math.max(0, percentage));
  const remaining = Math.max(0, target - current);

  // Hairline gauge color
  let gaugeColor = themeColors.accent;
  if (goal.isCompleted || percentage >= 100) {
    gaugeColor = themeColors.success;
  } else if (percentage >= 80) {
    gaugeColor = themeColors.warning;
  }

  const handleFund = () => {
    triggerHaptic('selection');
    onFundPress(goal);
  };

  const handleEdit = () => {
    triggerHaptic('selection');
    onEditPress(goal);
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        },
      ]}
    >
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          <View
            style={[
              styles.iconBox,
              {
                borderColor: themeColors.borderSubtle,
                backgroundColor: `${goal.color || themeColors.accent}15`,
              },
            ]}
          >
            <Text style={styles.emojiIcon}>{goal.icon || '🎯'}</Text>
          </View>

          <View style={styles.titleBlock}>
            <View style={styles.titleLine}>
              <Text
                style={[styles.goalName, { color: themeColors.text }]}
                numberOfLines={1}
              >
                {goal.name}
              </Text>
              {goal.isCompleted && (
                <View
                  style={[
                    styles.completedBadge,
                    {
                      borderColor: themeColors.success,
                      backgroundColor: `${themeColors.success}15`,
                    },
                  ]}
                >
                  <Text style={[styles.completedBadgeText, { color: themeColors.success }]}>
                    ACHIEVED
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.submetaText, { color: themeColors.textMuted }]}>
              {target > 0
                ? `${Math.round(percentage)}% of target saved`
                : 'Open savings target'}
            </Text>
          </View>
        </View>

        {/* Edit Button */}
        <TouchableOpacity
          onPress={handleEdit}
          style={[styles.editButton, { borderColor: themeColors.borderSubtle }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="pencil-outline" size={14} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Figures Row */}
      <View style={styles.figuresRow}>
        <View>
          <Text style={[styles.figureLabel, { color: themeColors.textMuted }]}>
            CURRENT SAVED
          </Text>
          <Text style={[styles.savedAmount, { color: themeColors.text }]}>
            {isBalanceHidden ? '••••' : formatCurrency(current, currency)}
          </Text>
        </View>

        {target > 0 && (
          <View style={styles.targetCol}>
            <Text style={[styles.figureLabel, { color: themeColors.textMuted }]}>
              TARGET AMOUNT
            </Text>
            <Text style={[styles.targetAmount, { color: themeColors.textSecondary }]}>
              {isBalanceHidden ? '••••' : formatCurrency(target, currency)}
            </Text>
          </View>
        )}
      </View>

      {/* 2px Hairline Progress Gauge */}
      {target > 0 && (
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
                  backgroundColor: gaugeColor,
                  width: `${cappedPercentage}%`,
                },
              ]}
            />
          </View>

          <View style={styles.gaugeFooter}>
            <Text style={[styles.remainingText, { color: themeColors.textMuted }]}>
              {goal.isCompleted
                ? 'Target achieved!'
                : `${isBalanceHidden ? '••••' : formatCurrency(remaining, currency)} remaining`}
            </Text>
            <Text style={[styles.percentageText, { color: gaugeColor }]}>
              {Math.round(percentage)}%
            </Text>
          </View>
        </View>
      )}

      {/* Action Row */}
      {!goal.isCompleted && (
        <View style={[styles.actionRow, { borderTopColor: themeColors.borderSubtle }]}>
          <TouchableOpacity
            style={[
              styles.fundButton,
              {
                backgroundColor: themeColors.surfaceElevated,
                borderColor: themeColors.border,
              },
            ]}
            onPress={handleFund}
            activeOpacity={0.7}
          >
            <Icon name="plus" size={14} color={themeColors.text} />
            <Text style={[styles.fundButtonText, { color: themeColors.text }]}>
              ADD FUNDS FROM WALLET
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    width: 38,
    height: 38,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  emojiIcon: {
    fontSize: 18,
  },
  titleBlock: {
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  goalName: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.2,
  },
  completedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: borderRadius.none,
  },
  completedBadgeText: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  submetaText: {
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  editButton: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  figuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  figureLabel: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  savedAmount: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  targetCol: {
    alignItems: 'flex-end',
  },
  targetAmount: {
    fontSize: 14,
    fontWeight: typography.weights.medium,
    fontVariant: ['tabular-nums'],
  },
  gaugeBlock: {
    marginTop: spacing.md,
    gap: 6,
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
  remainingText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  percentageText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  actionRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  fundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  fundButtonText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
});
