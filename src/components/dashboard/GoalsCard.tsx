/**
 * Purpose: Display goals summary card with active and completed counts
 *
 * Inputs:
 *   - activeGoalsCount (number): Number of active goals
 *   - completedGoalsCount (number): Number of completed goals
 *   - onViewAll (function): Callback when "View All" is pressed
 *
 * Outputs:
 *   - Returns (JSX.Element): Goals summary card component
 *
 * Side effects:
 *   - Calls onViewAll when View All button is pressed
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

interface GoalsCardProps {
  activeGoalsCount: number;
  completedGoalsCount: number;
  onViewAll: () => void;
}

export const GoalsCard: React.FC<GoalsCardProps> = React.memo(({
  activeGoalsCount,
  completedGoalsCount,
  onViewAll,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View style={styles.card}>
      {/* Icon Header */}
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name="flag-checkered"
          size={24}
          color={themeColors.goalGreen}
        />
      </View>

      {/* Title */}
      <Text style={styles.title}>GOALS</Text>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Active:</Text>
          <Text style={styles.statValue}>{activeGoalsCount}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Completed:</Text>
          <Text style={styles.statValue}>{completedGoalsCount}</Text>
        </View>
      </View>

      {/* View All Button */}
      <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
        <Text style={styles.viewAll}>VIEW ALL →</Text>
      </TouchableOpacity>
    </View>
  );
});

GoalsCard.displayName = 'GoalsCard';

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  card: {
    width: 180,
    backgroundColor: themeColors.glass.background,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: themeColors.glass.borderLight,
    minHeight: 160,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: themeColors.goalGreen + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.5)'
      : 'rgba(0, 0, 0, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  statsContainer: {
    flex: 1,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: themeColors.text,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: themeColors.goalGreen,
  },
  viewAll: {
    fontSize: 10,
    fontWeight: '700',
    color: themeColors.primary,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: themeColors.primary + '30',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
  },
});
