/**
 * Purpose: Display total balance with gradient background and vault breakdown
 *
 * Inputs:
 *   - totalBalance (number): Total balance across all vaults
 *   - mainBalance (number): Main vault balance
 *   - savingsBalance (number): Savings vault balance
 *   - heldBalance (number): Held money balance
 *   - accountCurrency (string): Currency code (e.g., 'USD')
 *
 * Outputs:
 *   - Returns (JSX.Element): Gradient balance card component
 *
 * Side effects: None
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

interface GradientBalanceCardProps {
  totalBalance: number;
  mainBalance: number;
  savingsBalance: number;
  heldBalance: number;
  accountCurrency?: string;
}

export const GradientBalanceCard: React.FC<GradientBalanceCardProps> = React.memo(({
  totalBalance,
  mainBalance,
  savingsBalance,
  heldBalance,
  accountCurrency = 'USD',
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const formatAmount = (amount: number) => {
    const sign = amount < 0 ? '-' : '';
    const formatted = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (accountCurrency === 'USD') {
      return `${sign}$${formatted}`;
    }
    return `${sign}${formatted} ${accountCurrency}`;
  };

  // Calculate gradient colors based on theme
  const gradientColors = themeColors.isDark
    ? [themeColors.background, '#1a3a3a', themeColors.background]
    : ['#e8f4f3', '#d0e9e7', '#e8f4f3'];

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      {/* Decorative wallet icon in background */}
      <View style={styles.iconBackground}>
        <MaterialCommunityIcons
          name="wallet-outline"
          size={80}
          color={themeColors.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Total Balance Section */}
        <View style={styles.totalSection}>
          <Text style={styles.label}>TOTAL BALANCE</Text>
          <Text style={styles.totalBalance}>{formatAmount(totalBalance)}</Text>
        </View>

        {/* Breakdown Section */}
        <View style={styles.breakdown}>
          {/* Main Balance */}
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>MAIN BALANCE</Text>
            <Text style={[styles.breakdownValue, { color: themeColors.primary }]}>
              {formatAmount(mainBalance)}
            </Text>
          </View>

          {/* Savings */}
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>SAVINGS</Text>
            <Text style={styles.breakdownValue}>
              {formatAmount(savingsBalance)}
            </Text>
          </View>

          {/* Held Money */}
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>HELD MONEY</Text>
            <Text style={styles.breakdownValue}>
              {formatAmount(heldBalance)}
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
});

GradientBalanceCard.displayName = 'GradientBalanceCard';

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  gradient: {
    borderRadius: 16,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 24,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.05)',
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  iconBackground: {
    position: 'absolute',
    top: 16,
    right: 16,
    opacity: 1,
  },
  content: {
    gap: spacing.lg,
    zIndex: 10,
  },
  totalSection: {
    gap: spacing.xs,
  },
  label: {
    ...typography.overline,
    fontSize: 10,
    fontWeight: '600',
    color: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.6)'
      : 'rgba(0, 0, 0, 0.5)',
    letterSpacing: 1.2,
  },
  totalBalance: {
    fontSize: 36,
    fontWeight: '700',
    color: themeColors.text,
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  breakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.08)',
    gap: spacing.sm,
  },
  breakdownItem: {
    flex: 1,
    gap: 4,
  },
  breakdownLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.4)'
      : 'rgba(0, 0, 0, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: themeColors.text,
  },
});
