// Simplizum Chronological Movements — Activity grouped by Today & Yesterday
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { isToday, isYesterday } from 'date-fns';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import type { TransactionWithCat } from '../../services/dashboardService';
import type { Wallet } from '../../types/models';

interface ChronologicalMovementsProps {
  transactions: TransactionWithCat[];
  wallets: Wallet[];
  currency: string;
  onSelectTransaction: (transaction: TransactionWithCat) => void;
  onViewAll: () => void;
  isBalanceHidden?: boolean;
}

export const ChronologicalMovements: React.FC<ChronologicalMovementsProps> = ({
  transactions,
  wallets,
  currency,
  onSelectTransaction,
  onViewAll,
  isBalanceHidden = false,
}) => {
  const themeColors = useThemeColors();

  const walletMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.forEach((w) => map.set(w.id, w.name));
    return map;
  }, [wallets]);

  // Group transactions into Today, Yesterday, and Older
  const { todayList, yesterdayList, olderList } = useMemo(() => {
    const today: TransactionWithCat[] = [];
    const yesterday: TransactionWithCat[] = [];
    const older: TransactionWithCat[] = [];

    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      if (isToday(d)) {
        today.push(tx);
      } else if (isYesterday(d)) {
        yesterday.push(tx);
      } else {
        older.push(tx);
      }
    });

    return { todayList: today, yesterdayList: yesterday, olderList: older };
  }, [transactions]);

  const renderGroup = (title: string, items: TransactionWithCat[]) => {
    if (items.length === 0) return null;

    return (
      <View key={title} style={styles.groupContainer}>
        <Text style={[styles.groupTitle, { color: themeColors.textMuted }]}>
          {title}
        </Text>

        <View style={[styles.groupCard, { borderColor: themeColors.hairline, backgroundColor: themeColors.card }]}>
          {items.map((tx, idx) => {
            const isLast = idx === items.length - 1;
            const walletId = tx.walletId || tx.vaultType || 'main';
            const walletName = walletMap.get(walletId) || walletId.toUpperCase();
            const isIncome = tx.type === 'income';
            const isTransfer = tx.type === 'transfer';
            const amountVal = tx.convertedAmount ?? tx.amount;
            const prefix = isTransfer ? '⇄ ' : isIncome ? '+' : '-';
            const amountStr = isBalanceHidden
              ? '••••'
              : `${prefix}${formatCurrency(amountVal, currency)}`;

            const amountColor = isTransfer
              ? themeColors.transfer
              : isIncome
              ? themeColors.success
              : themeColors.text;

            return (
              <TouchableOpacity
                key={tx.id}
                style={[
                  styles.txRow,
                  !isLast && { borderBottomWidth: 1, borderBottomColor: themeColors.hairline },
                ]}
                onPress={() => {
                  triggerHaptic('impactLight');
                  onSelectTransaction(tx);
                }}
                activeOpacity={0.7}
              >
                {/* Category Icon */}
                <View
                  style={[
                    styles.iconBox,
                    {
                      borderColor: themeColors.hairline,
                      backgroundColor: themeColors.surface,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={(tx.category.icon as any) || 'tag-outline'}
                    size={16}
                    color={themeColors.text}
                  />
                </View>

                {/* Text Details */}
                <View style={styles.detailsCol}>
                  <Text style={[styles.descriptionText, { color: themeColors.text }]} numberOfLines={1}>
                    {tx.description || tx.category.name}
                  </Text>
                  <View style={styles.badgeRow}>
                    <Text style={[styles.walletBadge, { color: themeColors.textSecondary }]}>
                      {walletName}
                    </Text>
                    {tx.category.name && tx.description && (
                      <Text style={[styles.categorySubtitle, { color: themeColors.textMuted }]}>
                        • {tx.category.name}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Tabular Amount */}
                <Text style={[styles.amountText, { color: amountColor }]}>
                  {amountStr}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const hasAnyTransactions = transactions.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>
          RECENT MOVEMENTS
        </Text>
      </View>

      {!hasAnyTransactions ? (
        <View style={[styles.emptyBox, { borderColor: themeColors.hairline, backgroundColor: themeColors.card }]}>
          <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
            No recent activity
          </Text>
        </View>
      ) : (
        <>
          {renderGroup('TODAY', todayList)}
          {renderGroup('YESTERDAY', yesterdayList)}
          {todayList.length === 0 && yesterdayList.length === 0 && renderGroup('RECENT', olderList)}

          {/* View All Button */}
          <TouchableOpacity
            style={[styles.viewAllButton, { borderColor: themeColors.hairline }]}
            onPress={() => {
              triggerHaptic('impactLight');
              onViewAll();
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewAllText, { color: themeColors.text }]}>
              VIEW ALL TRANSACTIONS
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color={themeColors.text} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 100, // padding for floating rail
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
    paddingLeft: 2,
  },
  groupCard: {
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailsCol: {
    flex: 1,
    marginRight: 10,
  },
  descriptionText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletBadge: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  categorySubtitle: {
    fontSize: 10,
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  viewAllButton: {
    height: 42,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  emptyBox: {
    padding: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
