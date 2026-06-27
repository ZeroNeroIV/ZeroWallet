import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { BentoCard } from './BentoCard';
import { useThemeColors } from '../../hooks/useThemeColors';

interface BalanceCardProps {
  totalBalance: number;
  monthlyChange: number;
  delay?: number;
  accountCurrency?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  totalBalance,
  monthlyChange,
  delay = 0,
  accountCurrency = 'USD',
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const formatAmount = (amount: number) => {
    if (accountCurrency === 'USD') {
      return `$${Math.abs(amount).toFixed(2)}`;
    }
    return `${Math.abs(amount).toFixed(2)} ${accountCurrency}`;
  };

  const isPositiveChange = monthlyChange >= 0;
  const changePercentage = totalBalance > 0
    ? ((monthlyChange / totalBalance) * 100).toFixed(1)
    : '0.0';

  return (
    <BentoCard delay={delay} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Total Balance</Text>
        <MaterialCommunityIcons
          name="wallet-outline"
          size={24}
          color={themeColors.primary}
        />
      </View>

      <View>
        <Text style={styles.balance}>{formatAmount(totalBalance)}</Text>
      </View>

      <View style={styles.changeContainer}>
        <View
          style={[
            styles.changeBadge,
            {
              backgroundColor: isPositiveChange
                ? themeColors.success + '20'
                : themeColors.error + '20',
            },
          ]}
        >
          <MaterialCommunityIcons
            name={isPositiveChange ? 'trending-up' : 'trending-down'}
            size={16}
            color={
              isPositiveChange
                ? themeColors.success
                : themeColors.error
            }
          />
          <Text
            style={[
              styles.changeText,
              {
                color: isPositiveChange
                  ? themeColors.success
                  : themeColors.error,
              },
            ]}
          >
            {isPositiveChange ? '+' : '-'}
            {formatAmount(monthlyChange)} ({changePercentage}%)
          </Text>
        </View>
        <Text style={styles.changeLabel}>This month</Text>
      </View>
    </BentoCard>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    minHeight: 160,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  balance: {
    ...typography.h1,
    fontSize: 42,
    fontWeight: '700',
    color: themeColors.text,
    marginBottom: spacing.md,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
    gap: spacing.xs,
  },
  changeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  changeLabel: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
});
