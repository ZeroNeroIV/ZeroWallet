/**
 * Purpose: Display categories summary card with total categories count
 *
 * Inputs:
 *   - totalCategoriesCount (number): Total number of categories
 *   - onViewAll (function): Callback when "View All" is pressed
 *
 * Outputs:
 *   - Returns (JSX.Element): Categories summary card component
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

interface CategoriesCardProps {
  totalCategoriesCount: number;
  onViewAll: () => void;
}

export const CategoriesCard: React.FC<CategoriesCardProps> = React.memo(({
  totalCategoriesCount,
  onViewAll,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Use a purple/blue color for categories
  const categoryColor = '#8b5cf6';

  return (
    <View style={styles.card}>
      {/* Icon Header */}
      <View style={[styles.iconContainer, { backgroundColor: categoryColor + '20' }]}>
        <MaterialCommunityIcons
          name="tag-multiple"
          size={24}
          color={categoryColor}
        />
      </View>

      {/* Title */}
      <Text style={styles.title}>CATEGORIES</Text>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total:</Text>
          <Text style={[styles.statValue, { color: categoryColor }]}>
            {totalCategoriesCount}
          </Text>
        </View>
      </View>

      {/* View All Button */}
      <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
        <Text style={styles.viewAll}>VIEW ALL →</Text>
      </TouchableOpacity>
    </View>
  );
});

CategoriesCard.displayName = 'CategoriesCard';

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
