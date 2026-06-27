/**
 * Purpose: Display horizontal scrollable list of goals and debts
 *
 * Inputs:
 *   - goals (Goal[]): Array of active goal objects
 *   - debts (Debt[]): Array of active debt objects
 *   - onViewAll (function): Callback when "View All" is pressed
 *   - onCardPress (function): Callback when a card is pressed, receives (id, type)
 *
 * Outputs:
 *   - Returns (JSX.Element): Horizontal scrollable goals and debts section
 *
 * Side effects:
 *   - Calls onViewAll when View All button is pressed
 *   - Calls onCardPress when a card is pressed
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Goal, Debt } from '../../types/models';

interface GoalsDebtsSectionProps {
  goals: Goal[];
  debts: Debt[];
  onViewAll: () => void;
  onCardPress: (id: string, type: 'goal' | 'debt') => void;
}

type CombinedItem = {
  id: string;
  type: 'goal' | 'debt';
  title: string;
  current: number;
  target: number;
  icon: string;
};

export const GoalsDebtsSection: React.FC<GoalsDebtsSectionProps> = React.memo(({
  goals,
  debts,
  onViewAll,
  onCardPress,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Combine goals and debts into single array
  const combinedItems: CombinedItem[] = useMemo(() => {
    const goalItems: CombinedItem[] = goals.slice(0, 3).map((goal) => ({
      id: goal.id,
      type: 'goal' as const,
      title: goal.name,
      current: goal.currentAmount,
      target: goal.targetAmount || 1,
      icon: goal.icon || 'flag-checkered',
    }));

    const debtItems: CombinedItem[] = debts.slice(0, 3).map((debt) => ({
      id: debt.id,
      type: 'debt' as const,
      title: debt.description,
      current: debt.amountPaid || 0,
      target: debt.amount,
      icon: 'hand-coin-outline',
    }));

    return [...debtItems, ...goalItems];
  }, [goals, debts]);

  const renderCard = useCallback(({ item }: { item: CombinedItem }) => {
    const progress = (item.current / item.target) * 100;
    const isGoal = item.type === 'goal';
    const color = isGoal ? themeColors.goalGreen : themeColors.debtRed;
    const remaining = item.target - item.current;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onCardPress(item.id, item.type)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            <MaterialCommunityIcons
              name={item.icon as any}
              size={20}
              color={color}
            />
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isGoal ? 'GOAL' : 'DEBT'}
            </Text>
          </View>
        </View>

        {/* Title and Amount */}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardSubtitle}>
          ${remaining.toFixed(2)} {isGoal ? 'of' : 'Remaining'} ${item.target.toFixed(0)}
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(progress, 100)}%`,
                  backgroundColor: color,
                  shadowColor: progress > 50 ? color : 'transparent',
                  shadowOpacity: progress > 50 ? 0.4 : 0,
                  shadowRadius: 8,
                  elevation: progress > 50 ? 2 : 0,
                },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>
              {isGoal ? 'Saved' : 'Repaid'}
            </Text>
            <Text style={styles.progressLabel}>
              {Math.round(progress)}%
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [styles, themeColors, onCardPress]);

  if (combinedItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Goals & Debts</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <Text style={styles.viewAll}>VIEW ALL</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal List */}
      <FlatList
        horizontal
        data={combinedItems}
        renderItem={renderCard}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={3}
      />
    </View>
  );
});

GoalsDebtsSection.displayName = 'GoalsDebtsSection';

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    color: themeColors.text,
  },
  viewAll: {
    fontSize: 10,
    fontWeight: '700',
    color: themeColors.primary,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: themeColors.primary + '30',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: 240,
    backgroundColor: themeColors.glass.background,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: themeColors.glass.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.4)'
      : 'rgba(0, 0, 0, 0.4)',
    textTransform: 'uppercase',
  },
  cardTitle: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: themeColors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.5)'
      : 'rgba(0, 0, 0, 0.5)',
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  progressContainer: {
    gap: spacing.sm,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.3)'
      : 'rgba(0, 0, 0, 0.3)',
    textTransform: 'uppercase',
  },
});
