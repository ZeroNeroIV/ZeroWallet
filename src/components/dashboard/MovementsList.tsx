/**
 * Purpose: Display recent transactions in compact format
 *
 * Inputs:
 *   - transactions (TransactionWithCategory[]): Array of recent transactions with categories
 *   - accountCurrency (string): Currency code (e.g., 'USD')
 *   - onViewAll (function): Callback when "View All" is pressed
 *   - onTransactionPress (function): Callback when transaction is pressed, receives transaction object
 *
 * Outputs:
 *   - Returns (JSX.Element): Recent movements list component
 *
 * Side effects:
 *   - Calls onViewAll when View All button is pressed
 *   - Calls onTransactionPress when a transaction is pressed
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Transaction, Category } from '../../types/models';

interface TransactionWithCategory extends Transaction {
  category: Category;
}

interface MovementsListProps {
  transactions: TransactionWithCategory[];
  accountCurrency?: string;
  onViewAll: () => void;
  onTransactionPress: (transaction: Transaction) => void;
}

export const MovementsList: React.FC<MovementsListProps> = React.memo(({
  transactions,
  accountCurrency = 'USD',
  onViewAll,
  onTransactionPress,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const formatAmount = useCallback((amount: number, type: string) => {
    const sign = type === 'income' ? '+' : '-';
    if (accountCurrency === 'USD') {
      return `${sign}$${Math.abs(amount).toFixed(2)}`;
    }
    return `${sign}${Math.abs(amount).toFixed(2)} ${accountCurrency}`;
  }, [accountCurrency]);

  const getIconGradient = useCallback((type: string): [string, string] => {
    if (type === 'income') {
      return ['#10b981', '#06d6a0']; // Green gradient
    }
    return ['#ff6b6b', '#ff4d4d']; // Red gradient
  }, []);

  const renderTransaction = useCallback((transaction: TransactionWithCategory) => {
    const gradientColors = getIconGradient(transaction.type);

    return (
      <TouchableOpacity
        key={transaction.id}
        style={styles.transactionCard}
        onPress={() => onTransactionPress(transaction)}
        activeOpacity={0.7}
      >
        <View style={styles.transactionContent}>
          {/* Icon */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <MaterialCommunityIcons
              name={transaction.category?.icon || 'cash'}
              size={20}
              color="white"
            />
          </LinearGradient>

          {/* Info */}
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionTitle} numberOfLines={1}>
              {transaction.description || transaction.category?.name}
            </Text>
            <Text style={styles.transactionCategory} numberOfLines={1}>
              {transaction.category?.name?.toUpperCase() || 'UNCATEGORIZED'}
            </Text>
          </View>
        </View>

        {/* Amount */}
        <Text
          style={[
            styles.amount,
            {
              color: transaction.type === 'income'
                ? themeColors.primary
                : themeColors.text,
            },
          ]}
        >
          {formatAmount(transaction.amount, transaction.type)}
        </Text>
      </TouchableOpacity>
    );
  }, [styles, themeColors, getIconGradient, formatAmount, onTransactionPress]);

  if (transactions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Recent Movements</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <Text style={styles.viewAll}>VIEW ALL</Text>
        </TouchableOpacity>
      </View>

      {/* Transactions List */}
      <View style={styles.list}>
        {transactions.map(renderTransaction)}
      </View>
    </View>
  );
});

MovementsList.displayName = 'MovementsList';

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingBottom: 100, // Space for bottom navigation
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    letterSpacing: 0.5,
  },
  list: {
    gap: spacing.md,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: themeColors.glass.background,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: themeColors.glass.border,
  },
  transactionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  iconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    gap: 2,
  },
  transactionTitle: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: themeColors.text,
  },
  transactionCategory: {
    fontSize: 9,
    fontWeight: '700',
    color: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.4)'
      : 'rgba(0, 0, 0, 0.4)',
    textTransform: 'uppercase',
  },
  amount: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '700',
  },
});
