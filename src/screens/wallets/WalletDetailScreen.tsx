// Simplizum Wallet Detail Screen — Isolated Ledger, 30-Day Sparkline, and Direct Transfer Routing
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, isToday, isYesterday } from 'date-fns';
import type { MainStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { WalletService, type WalletDetailData } from '../../services/walletService';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import { CashFlowTrend } from '../../components/dashboard/CashFlowTrend';
import { WalletFormModal } from '../../components/wallets/WalletFormModal';
import type { Transaction } from '../../types/models';

type NavigationProp = StackNavigationProp<MainStackParamList, 'WalletDetails'>;
type RouteProps = RouteProp<MainStackParamList, 'WalletDetails'>;

export default function WalletDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const walletId = route.params.walletId;
  const currentAccountId = useAuthStore((s) => s.currentAccountId);
  const themeColors = useThemeColors();

  const [data, setData] = useState<WalletDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);

  const walletService = useMemo(() => new WalletService(), []);

  const loadData = useCallback(async () => {
    if (!currentAccountId || !walletId) return;
    try {
      const res = await walletService.loadWalletDetail(currentAccountId, walletId);
      setData(res);
    } catch (err) {
      console.warn('[WalletDetailScreen] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccountId, walletId, walletService]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const isNegative = (data?.derivedBalance ?? 0) < -0.001;

  // Group transactions chronologically
  const groupedTransactions = useMemo(() => {
    if (!data?.transactions) return [];

    const groups: { title: string; items: Transaction[] } = {
      title: '',
      items: [],
    };
    const todayItems: Transaction[] = [];
    const yesterdayItems: Transaction[] = [];
    const earlierItems: Transaction[] = [];

    for (const tx of data.transactions) {
      const d = new Date(tx.date);
      if (isToday(d)) {
        todayItems.push(tx);
      } else if (isYesterday(d)) {
        yesterdayItems.push(tx);
      } else {
        earlierItems.push(tx);
      }
    }

    const result = [];
    if (todayItems.length > 0) result.push({ title: 'TODAY', items: todayItems });
    if (yesterdayItems.length > 0) result.push({ title: 'YESTERDAY', items: yesterdayItems });
    if (earlierItems.length > 0) result.push({ title: 'EARLIER ACTIVITY', items: earlierItems });
    return result;
  }, [data?.transactions]);

  const handleSaveWallet = async (updated: {
    id?: string;
    name: string;
    icon: string;
    color: string;
    isDefault: boolean;
  }) => {
    if (!currentAccountId || !updated.id) return;
    const repo = new WalletRepository();
    await repo.update(
      updated.id,
      {
        name: updated.name,
        icon: updated.icon,
        color: updated.color,
        isDefault: updated.isDefault,
      },
      currentAccountId
    );

    if (updated.isDefault) {
      const all = await repo.findByAccount(currentAccountId);
      for (const item of all) {
        if (item.isDefault && item.id !== updated.id) {
          await repo.update(item.id, { isDefault: false }, currentAccountId);
        }
      }
    }

    await loadData();
  };

  if (loading && !data) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator color={themeColors.text} size="small" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.errorText, { color: themeColors.textMuted }]}>
          Wallet not found
        </Text>
      </View>
    );
  }

  const { wallet, currency, derivedBalance, trend30Day, net30DayChange, totalInflow30Day, totalOutflow30Day } = data;

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.text}
          />
        }
      >
        {/* Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          {/* Top Identifier Row */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroLeftMeta}>
              <View
                style={[
                  styles.heroIconBadge,
                  {
                    backgroundColor: themeColors.background,
                    borderColor: themeColors.hairline,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={wallet.icon || 'wallet-outline'}
                  size={20}
                  color={isNegative ? themeColors.error : themeColors.text}
                />
              </View>
              <View>
                <Text style={[styles.walletTitle, { color: themeColors.text }]}>
                  {wallet.name}
                </Text>
                <View style={styles.tagRow}>
                  {wallet.isDefault && (
                    <View
                      style={[
                        styles.defaultTag,
                        { borderColor: themeColors.text, backgroundColor: themeColors.text },
                      ]}
                    >
                      <Text style={[styles.defaultTagText, { color: themeColors.background }]}>
                        DEFAULT
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.txCountTag, { color: themeColors.textMuted }]}>
                    {data.transactionCount} TRANSACTIONS
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('selection');
                setFormModalVisible(true);
              }}
              style={[
                styles.editBtn,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.background,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={16}
                color={themeColors.text}
              />
            </TouchableOpacity>
          </View>

          {/* Large Tabular Derived Balance */}
          <View style={styles.balanceContainer}>
            <Text
              style={[
                styles.balanceAmount,
                {
                  color: isNegative ? themeColors.error : themeColors.text,
                },
              ]}
            >
              {formatCurrency(derivedBalance, currency)}
            </Text>
            {isNegative && (
              <Text style={[styles.liabilityWarning, { color: themeColors.error }]}>
                LIABILITY / CREDIT BALANCE
              </Text>
            )}
          </View>

          {/* 30-Day Quick Inflow/Outflow Metrics */}
          <View style={[styles.metricsDivider, { backgroundColor: themeColors.hairline }]} />
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: themeColors.textMuted }]}>
                30D INFLOW
              </Text>
              <Text style={[styles.metricValue, { color: themeColors.success }]}>
                +{formatCurrency(totalInflow30Day, currency)}
              </Text>
            </View>

            <View style={[styles.verticalDivider, { backgroundColor: themeColors.hairline }]} />

            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: themeColors.textMuted }]}>
                30D OUTFLOW
              </Text>
              <Text style={[styles.metricValue, { color: themeColors.text }]}>
                -{formatCurrency(totalOutflow30Day, currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Duo: Transfer & Log Transaction */}
        <View style={styles.actionDuoRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('selection');
              navigation.navigate('Transfer', { fromWalletId: wallet.id });
            }}
            style={[
              styles.actionBtn,
              {
                borderColor: themeColors.cardBorder,
                backgroundColor: themeColors.surface,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="swap-vertical"
              size={18}
              color={themeColors.text}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.actionBtnText, { color: themeColors.text }]}>
              TRANSFER
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('selection');
              navigation.navigate('AddTransaction', { type: 'expense' });
            }}
            style={[
              styles.actionBtn,
              {
                borderColor: themeColors.cardBorder,
                backgroundColor: themeColors.surface,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="plus"
              size={18}
              color={themeColors.text}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.actionBtnText, { color: themeColors.text }]}>
              LOG ENTRY
            </Text>
          </TouchableOpacity>
        </View>

        {/* 30-Day Trend Chart */}
        {trend30Day && trend30Day.length > 0 && (
          <CashFlowTrend
            data={trend30Day}
            netChange={net30DayChange}
            currency={currency}
          />
        )}

        {/* Isolated Transaction Ledger */}
        <View style={styles.ledgerSection}>
          <View style={styles.ledgerHeader}>
            <Text style={[styles.ledgerTitle, { color: themeColors.textMuted }]}>
              ISOLATED LEDGER
            </Text>
            <Text style={[styles.ledgerSub, { color: themeColors.textMuted }]}>
              CHRONOLOGICAL
            </Text>
          </View>

          {groupedTransactions.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.cardBorder,
                },
              ]}
            >
              <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                No transactions recorded for this wallet.
              </Text>
            </View>
          ) : (
            groupedTransactions.map((group) => (
              <View key={group.title} style={styles.groupContainer}>
                <Text style={[styles.groupTitle, { color: themeColors.textMuted }]}>
                  {group.title}
                </Text>

                <View
                  style={[
                    styles.groupCard,
                    {
                      backgroundColor: themeColors.surface,
                      borderColor: themeColors.cardBorder,
                    },
                  ]}
                >
                  {group.items.map((tx, idx) => {
                    const isLast = idx === group.items.length - 1;
                    const isIncome = tx.type === 'income' || (tx.type === 'transfer' && tx.destinationWalletId === wallet.id);
                    const isTransfer = tx.type === 'transfer' || !!tx.destinationWalletId;
                    const amt = tx.convertedAmount ?? tx.amount;

                    return (
                      <TouchableOpacity
                        key={tx.id}
                        activeOpacity={0.7}
                        onPress={() => {
                          triggerHaptic('selection');
                          navigation.navigate('TransactionDetails', { transactionId: tx.id });
                        }}
                        style={[
                          styles.txRow,
                          !isLast && { borderBottomWidth: 1, borderBottomColor: themeColors.hairline },
                        ]}
                      >
                        <View style={styles.txLeft}>
                          <View
                            style={[
                              styles.txIconBadge,
                              {
                                backgroundColor: themeColors.background,
                                borderColor: themeColors.hairline,
                              },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={isTransfer ? 'swap-vertical' : isIncome ? 'arrow-down-left' : 'arrow-up-right'}
                              size={16}
                              color={isIncome ? themeColors.success : themeColors.text}
                            />
                          </View>
                          <View style={styles.txMeta}>
                            <Text
                              style={[styles.txDesc, { color: themeColors.text }]}
                              numberOfLines={1}
                            >
                              {tx.description || (isIncome ? 'Deposit' : 'Payment')}
                            </Text>
                            <Text style={[styles.txDate, { color: themeColors.textMuted }]}>
                              {format(new Date(tx.date), 'h:mm a')}
                              {isTransfer ? ' • Transfer' : ''}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.txAmount,
                            {
                              color: isIncome ? themeColors.success : themeColors.text,
                            },
                          ]}
                        >
                          {isIncome ? '+' : '-'}{formatCurrency(amt, currency)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Wallet Modal */}
      <WalletFormModal
        visible={formModalVisible}
        wallet={wallet}
        currency={currency}
        onClose={() => setFormModalVisible(false)}
        onSave={handleSaveWallet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs, // 2px subtle corner
    padding: 18,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroLeftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  heroIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  defaultTag: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 1,
  },
  defaultTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  txCountTag: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceContainer: {
    marginBottom: 16,
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  liabilityWarning: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  metricsDivider: {
    height: 1,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
  },
  verticalDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 16,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionDuoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  ledgerSection: {
    marginTop: 20,
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  ledgerTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ledgerSub: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  emptyCard: {
    padding: 24,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  txIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txMeta: {
    flex: 1,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
});
