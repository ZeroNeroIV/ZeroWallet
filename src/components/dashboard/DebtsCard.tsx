/**
 * Purpose: Display debts summary card with lent and borrowed amounts
 *
 * Inputs:
 *   - totalLent (number): Money owed to me
 *   - totalBorrowed (number): Money I owe
 *   - accountCurrency (string): Currency code for formatting
 *   - onViewAll (function): Callback when "View All" is pressed
 *
 * Outputs:
 *   - Returns (JSX.Element): Debts summary card component
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

interface DebtsCardProps {
  totalLent: number;
  totalBorrowed: number;
  accountCurrency: string;
  onViewAll: () => void;
}

const formatCurrency = (amount: number, currency: string): string => {
  const currencySymbols: { [key: string]: string } = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
  };
  const symbol = currencySymbols[currency] || currency + ' ';
  return `${symbol}${Math.abs(amount).toFixed(0)}`;
};

export const DebtsCard: React.FC<DebtsCardProps> = React.memo(({
  totalLent,
  totalBorrowed,
  accountCurrency,
  onViewAll,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View style={styles.card}>
      {/* Icon Header */}
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name="hand-coin-outline"
          size={24}
          color={themeColors.debtRed}
        />
      </View>

      {/* Title */}
      <Text style={styles.title}>DEBTS</Text>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Owed to me:</Text>
          <Text style={[styles.statValue, { color: themeColors.goalGreen }]}>
            {formatCurrency(totalLent, accountCurrency)}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>I owe:</Text>
          <Text style={[styles.statValue, { color: themeColors.debtRed }]}>
            {formatCurrency(totalBorrowed, accountCurrency)}
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

DebtsCard.displayName = 'DebtsCard';

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
    backgroundColor: themeColors.debtRed + '20',
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
