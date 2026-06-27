import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { BentoCard } from './BentoCard';
import { useThemeColors } from '../../hooks/useThemeColors';

interface QuickStatsProps {
  monthlyIncome: number;
  monthlyExpense: number;
  delay?: number;
  accountCurrency?: string;
}

export const QuickStats: React.FC<QuickStatsProps> = ({
  monthlyIncome,
  monthlyExpense,
  delay = 0,
  accountCurrency = 'USD',
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const formatAmount = (amount: number) => {
    if (accountCurrency === 'USD') {
      return `$${amount.toFixed(2)}`;
    }
    return `${amount.toFixed(2)} ${accountCurrency}`;
  };

  const netAmount = monthlyIncome - monthlyExpense;
  const isPositive = netAmount >= 0;

  const stats = [
    {
      label: 'Income',
      amount: monthlyIncome,
      icon: 'arrow-down-circle',
      color: themeColors.success,
      bgColor: themeColors.success + '20',
    },
    {
      label: 'Expenses',
      amount: monthlyExpense,
      icon: 'arrow-up-circle',
      color: themeColors.error,
      bgColor: themeColors.error + '20',
    },
  ];

  return (
    <BentoCard delay={delay} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>This Month</Text>
        <MaterialCommunityIcons
          name="calendar-month"
          size={20}
          color={themeColors.primary}
        />
      </View>

      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <View key={stat.label} style={styles.statItem}>
            <View style={[styles.iconContainer, { backgroundColor: stat.bgColor }]}>
              <MaterialCommunityIcons
                name={stat.icon as any}
                size={20}
                color={stat.color}
              />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statAmount, { color: stat.color }]}>
                {formatAmount(stat.amount)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.netContainer}>
        <View style={styles.netLeft}>
          <MaterialCommunityIcons
            name={isPositive ? 'trending-up' : 'trending-down'}
            size={20}
            color={isPositive ? themeColors.success : themeColors.error}
          />
          <Text style={styles.netLabel}>Net</Text>
        </View>
        <Text
          style={[
            styles.netAmount,
            {
              color: isPositive
                ? themeColors.success
                : themeColors.error,
            },
          ]}
        >
          {isPositive ? '+' : ''}
          {formatAmount(netAmount)}
        </Text>
      </View>
    </BentoCard>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    minHeight: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    color: themeColors.text,
  },
  statsContainer: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    ...typography.body,
    color: themeColors.textSecondary,
  },
  statAmount: {
    ...typography.h3,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: themeColors.border,
    marginVertical: spacing.sm,
  },
  netContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  netLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  netLabel: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  netAmount: {
    ...typography.h2,
    fontWeight: '700',
  },
});
