import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ALL_WALLETS, WALLET_META, getWalletBalance } from '../../utils/wallets';
import type { VaultBalances } from '../../utils/balanceCalculator';

const WALLET_CARD_COLORS = [
  '#6366F1',
  '#06D6A0',
  '#F59E0B',
  '#10B981',
  '#EF476F',
  '#118AB2',
  '#F77F00',
];

interface VaultCardProps {
  balances: VaultBalances;
  totalBalance: number;
  availableBalance: number;
  onPress?: () => void;
  accountCurrency?: string;
}

export const VaultCard: React.FC<VaultCardProps> = ({
  balances,
  totalBalance,
  availableBalance,
  onPress,
  accountCurrency = 'USD',
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const formatAmount = (amount: number) => {
    if (accountCurrency === 'USD') {
      return `$${amount.toFixed(3)}`;
    }
    return `${amount.toFixed(3)} ${accountCurrency}`;
  };

  const calculatePercentage = (amount: number) => {
    if (totalBalance === 0) return 0;
    return ((amount / totalBalance) * 100).toFixed(0);
  };

  const vaults = ALL_WALLETS.map((wallet, index) => {
    const balance = getWalletBalance(balances, wallet);
    return {
      name: WALLET_META[wallet].name,
      icon: WALLET_META[wallet].icon,
      balance,
      color: WALLET_CARD_COLORS[index % WALLET_CARD_COLORS.length],
      percentage: calculatePercentage(balance),
    };
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Wallets</Text>
        {onPress && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={themeColors.textSecondary}
          />
        )}
      </View>

      {/* Available to Spend */}
      <View style={styles.availableSection}>
        <Text style={styles.availableLabel}>Available to Spend</Text>
        <Text style={styles.availableAmount}>{formatAmount(availableBalance)}</Text>
        <Text style={styles.availableHint}>
          Total minus Recurring wallet
        </Text>
      </View>

      {/* Wallet Breakdown */}
      <View style={styles.vaultsContainer}>
        {vaults.map((vault, index) => (
          <View key={vault.name} style={styles.vaultItem}>
            <View style={[styles.vaultIcon, { backgroundColor: vault.color }]}>
              <MaterialCommunityIcons
                name={vault.icon as any}
                size={20}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.vaultName}>{vault.name}</Text>
            <Text style={styles.vaultAmount}>{formatAmount(vault.balance)}</Text>
            <Text style={styles.vaultPercentage}>{vault.percentage}%</Text>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${vault.percentage}%` as any,
                    backgroundColor: vault.color,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Total Balance */}
      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total Balance</Text>
        <Text style={styles.totalAmount}>{formatAmount(totalBalance)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    backgroundColor: themeColors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: themeColors.text,
  },
  availableSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  availableLabel: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginBottom: spacing.xs,
  },
  availableAmount: {
    ...typography.h1,
    fontWeight: '700',
    color: themeColors.primary,
    marginBottom: spacing.xs,
  },
  availableHint: {
    ...typography.caption,
    color: themeColors.textSecondary,
    fontStyle: 'italic',
  },
  vaultsContainer: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  vaultItem: {
    gap: spacing.xs,
  },
  vaultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  vaultName: {
    ...typography.caption,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  vaultAmount: {
    ...typography.h3,
    fontWeight: '700',
    color: themeColors.text,
  },
  vaultPercentage: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: themeColors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
  totalLabel: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  totalAmount: {
    ...typography.h2,
    fontWeight: '700',
    color: themeColors.text,
  },
});
