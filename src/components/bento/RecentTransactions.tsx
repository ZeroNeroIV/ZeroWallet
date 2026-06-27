import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { BentoCard } from './BentoCard';
import { Transaction, Category } from '../../types/models';
import { format } from 'date-fns';
import { useThemeColors } from '../../hooks/useThemeColors';

interface RecentTransactionsProps {
  transactions: Array<Transaction & { category: Category }>;
  onViewAll: () => void;
  onTransactionPress: (transaction: Transaction) => void;
  delay?: number;
  accountCurrency?: string; // Account's base currency
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  onViewAll,
  onTransactionPress,
  delay = 0,
  accountCurrency = 'USD',
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const formatAmount = (amount: number, type: 'income' | 'expense', currency: string) => {
    const sign = type === 'income' ? '+' : '-';
    if (currency === 'USD') {
      return `${sign}$${amount.toFixed(2)}`;
    }
    return `${sign}${amount.toFixed(2)} ${currency}`;
  };

  const renderTransaction = ({
    item,
  }: {
    item: Transaction & { category: Category };
  }) => (
    <TouchableOpacity
      style={styles.transactionItem}
      onPress={() => onTransactionPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.transactionLeft}>
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: item.category.color + '20' },
          ]}
        >
          <MaterialCommunityIcons
            name={item.category.icon as any}
            size={20}
            color={item.category.color}
          />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionCategory} numberOfLines={1}>
            {item.category.name}
          </Text>
          <Text style={styles.transactionDate}>
            {format(new Date(item.date), 'MMM d')}
          </Text>
        </View>
      </View>

      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.transactionAmount,
            {
              color:
                item.type === 'income'
                  ? themeColors.success
                  : themeColors.text,
            },
          ]}
        >
          {formatAmount(item.convertedAmount || item.amount, item.type, accountCurrency)}
        </Text>
        {item.convertedAmount && item.currency !== accountCurrency && (
          <Text style={styles.originalAmount}>
            From {item.amount.toFixed(2)} {item.currency}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="receipt-text-outline"
        size={40}
        color={themeColors.textSecondary}
      />
      <Text style={styles.emptyText}>No transactions yet</Text>
      <Text style={styles.emptySubtext}>
        Start tracking your money by adding your first transaction
      </Text>
    </View>
  );

  return (
    <BentoCard delay={delay} style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Recent Activity</Text>
          <Text style={styles.subtitle}>Last 5 transactions</Text>
        </View>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <View style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={themeColors.primary}
            />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        {transactions.length > 0 ? (
          <FlatList
            data={transactions.slice(0, 5)}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          renderEmpty()
        )}
      </View>
    </BentoCard>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    color: themeColors.text,
  },
  subtitle: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  viewAllText: {
    ...typography.caption,
    fontWeight: '600',
    color: themeColors.primary,
  },
  listContainer: {
    flex: 1,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  transactionCategory: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  transactionDate: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  transactionAmount: {
    ...typography.body,
    fontWeight: '700',
  },
  originalAmount: {
    ...typography.caption,
    color: themeColors.textSecondary,
    fontSize: 10,
  },
  separator: {
    height: 1,
    backgroundColor: themeColors.border,
    marginVertical: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.textSecondary,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    ...typography.caption,
    color: themeColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
