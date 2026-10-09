// Simplizum Activity Ledger — Chronological Timeline with Razor-Thin Hairlines & Instant Floating Filter Rail
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, isToday, isYesterday, subDays, startOfMonth } from 'date-fns';
import type { MainStackParamList } from '../../types/navigation';
import type { Transaction, Category, Wallet } from '../../types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { QuickAddSheet, type QuickAddAction } from '../../components/navigation/QuickAddSheet';
import { borderRadius } from '../../theme/spacing';

type Nav = StackNavigationProp<MainStackParamList, 'TransactionHistory'>;

interface TransactionWithCategory extends Transaction {
  category?: Category;
  walletName?: string;
  destinationWalletName?: string;
}

type TypeFilter = 'all' | 'expense' | 'income' | 'transfer';
type DateFilter = 'all' | '30days' | 'thisMonth';

export const TransactionHistoryScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { currentAccountId, currentUser } = useAuthStore();
  const themeColors = useThemeColors();
  const isBalanceHidden = useUIStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useUIStore((s) => s.toggleBalanceHidden);

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const handleQuickAdd = useCallback(
    (action: QuickAddAction) => {
      setShowQuickAdd(false);
      if (action === 'expense') {
        navigation.navigate('AddTransaction', { type: 'expense' });
      } else if (action === 'income') {
        navigation.navigate('AddTransaction', { type: 'income' });
      } else {
        navigation.navigate('Transfer');
      }
    },
    [navigation]
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const loadData = useCallback(async () => {
    if (!currentAccountId || !currentUser) return;
    try {
      const txRepo = new TransactionRepository();
      const catRepo = new CategoryRepository();
      const walletRepo = new WalletRepository();
      const accRepo = new AccountRepository();

      const [txs, cats, walletList, acc] = await Promise.all([
        txRepo.findByAccount(currentAccountId),
        catRepo.findByUser(currentUser.id),
        walletRepo.findByAccount(currentAccountId),
        accRepo.findById(currentAccountId),
      ]);

      if (acc?.currency) setAccountCurrency(acc.currency);
      setWallets(walletList);

      const catMap = new Map<string, Category>();
      cats.forEach((c) => catMap.set(c.id, c));

      const walletMap = new Map<string, string>();
      walletList.forEach((w) => walletMap.set(w.id, w.name));

      const enriched: TransactionWithCategory[] = txs.map((t) => ({
        ...t,
        category: t.categoryId ? catMap.get(t.categoryId) : undefined,
        walletName: t.walletId ? walletMap.get(t.walletId) : walletMap.get(t.vaultType) || t.vaultType,
        destinationWalletName: t.destinationWalletId ? walletMap.get(t.destinationWalletId) : undefined,
      }));

      setTransactions(enriched);
    } catch (err) {
      console.warn('[TransactionHistory] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccountId, currentUser]);

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

  // Filter pipeline
  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const thirtyDaysAgo = subDays(new Date(), 30).getTime();
    const startOfCurrentMonth = startOfMonth(new Date()).getTime();

    return transactions.filter((t) => {
      // Type filter
      if (typeFilter !== 'all') {
        const isTransfer = t.type === 'transfer' || !!t.destinationWalletId;
        if (typeFilter === 'transfer' && !isTransfer) return false;
        if (typeFilter === 'expense' && (t.type !== 'expense' || isTransfer)) return false;
        if (typeFilter === 'income' && (t.type !== 'income' || isTransfer)) return false;
      }

      // Wallet filter
      if (selectedWalletId !== 'all') {
        const affectsWallet =
          t.walletId === selectedWalletId ||
          t.vaultType === selectedWalletId ||
          t.destinationWalletId === selectedWalletId;
        if (!affectsWallet) return false;
      }

      // Date filter
      if (dateFilter === '30days' && t.date < thirtyDaysAgo) return false;
      if (dateFilter === 'thisMonth' && t.date < startOfCurrentMonth) return false;

      // Search text query
      if (query) {
        const desc = (t.description || '').toLowerCase();
        const catName = (t.category?.name || '').toLowerCase();
        const wName = (t.walletName || '').toLowerCase();
        if (!desc.includes(query) && !catName.includes(query) && !wName.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, searchQuery, typeFilter, selectedWalletId, dateFilter]);

  // Aggregate stats for filtered items
  const stats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of filteredTransactions) {
      const amt = t.convertedAmount ?? t.amount;
      const isTransfer = t.type === 'transfer' || !!t.destinationWalletId;
      if (!isTransfer) {
        if (t.type === 'income') inflow += amt;
        else if (t.type === 'expense') outflow += amt;
      }
    }
    return {
      inflow,
      outflow,
      net: inflow - outflow,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // Chronological grouping (Today, Yesterday, 18 Oct 2026, etc.)
  const chronologicalGroups = useMemo(() => {
    const map = new Map<string, TransactionWithCategory[]>();

    for (const t of filteredTransactions) {
      const d = new Date(t.date);
      let label = format(d, 'd MMM yyyy').toUpperCase();
      if (isToday(d)) label = 'TODAY';
      else if (isYesterday(d)) label = 'YESTERDAY';

      const existing = map.get(label);
      if (existing) {
        existing.push(t);
      } else {
        map.set(label, [t]);
      }
    }

    const groups: Array<{ label: string; items: TransactionWithCategory[] }> = [];
    map.forEach((items, label) => {
      groups.push({ label, items });
    });
    return groups;
  }, [filteredTransactions]);

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <QuickAddSheet
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSelect={handleQuickAdd}
      />

      {/* Simplizum Activity Command Header */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: themeColors.hairline,
            backgroundColor: themeColors.background,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('impactLight');
                navigation.goBack();
              }}
              delayPressIn={0}
              style={[
                styles.headerBackBtn,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.surface,
                },
              ]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons name="arrow-left" size={18} color={themeColors.text} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={[styles.headerSuper, { color: themeColors.textMuted }]}>
              ZERO WALLET · LEDGER
            </Text>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>
              ACTIVITY
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              {
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.surface,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              toggleBalanceHidden();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityLabel="Toggle Number Visibility"
          >
            <MaterialCommunityIcons
              name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={themeColors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              {
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.surface,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              navigation.navigate('Calendar');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityLabel="Financial Calendar"
          >
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={18}
              color={themeColors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              styles.headerAddBtn,
              {
                borderColor: themeColors.primary,
                backgroundColor: themeColors.primary,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setShowQuickAdd(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
            accessibilityLabel="Add Transaction or Transfer"
          >
            <MaterialCommunityIcons name="plus" size={18} color={themeColors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 1. Instant Floating Search & Filter Bar */}
      <View
        style={[
          styles.filterHeader,
          {
            backgroundColor: themeColors.surface,
            borderBottomColor: themeColors.hairline,
          },
        ]}
      >
        {/* Search Input Box */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: themeColors.background,
              borderColor: themeColors.hairline,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color={themeColors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search description, category, or wallet..."
            placeholderTextColor={themeColors.textMuted}
            style={[styles.searchInput, { color: themeColors.text }]}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close-circle" size={16} color={themeColors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Horizontal Filter Chips Rail */}
        <ScrollView
          horizontal
          nestedScrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
        >
          {/* Type Filters */}
          {(['all', 'expense', 'income', 'transfer'] as TypeFilter[]).map((tf) => {
            const isSelected = typeFilter === tf;
            return (
              <TouchableOpacity
                key={tf}
                activeOpacity={0.7}
                delayPressIn={0}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => {
                  triggerHaptic('selection');
                  setTypeFilter(tf);
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: isSelected ? themeColors.text : themeColors.hairline,
                    backgroundColor: isSelected ? themeColors.text : themeColors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? themeColors.background : themeColors.text,
                    },
                  ]}
                >
                  {tf.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={[styles.chipDivider, { backgroundColor: themeColors.hairline }]} />

          {/* Date Filter Chips */}
          {(['all', '30days', 'thisMonth'] as DateFilter[]).map((df) => {
            const isSelected = dateFilter === df;
            const label = df === 'all' ? 'ALL TIME' : df === '30days' ? 'LAST 30D' : 'THIS MONTH';
            return (
              <TouchableOpacity
                key={df}
                activeOpacity={0.7}
                delayPressIn={0}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => {
                  triggerHaptic('selection');
                  setDateFilter(df);
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: isSelected ? themeColors.text : themeColors.hairline,
                    backgroundColor: isSelected ? themeColors.text : themeColors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? themeColors.background : themeColors.text,
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. Micro Summary Bar */}
      <View
        style={[
          styles.summaryBar,
          {
            backgroundColor: themeColors.surface,
            borderBottomColor: themeColors.hairline,
          },
        ]}
      >
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: themeColors.textMuted }]}>
            INFLOW
          </Text>
          <Text
            style={[styles.summaryValue, { color: themeColors.success }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {isBalanceHidden ? '••••' : `+${formatCurrency(stats.inflow, accountCurrency)}`}
          </Text>
        </View>

        <View style={[styles.summaryDivider, { backgroundColor: themeColors.hairline }]} />

        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: themeColors.textMuted }]}>
            OUTFLOW
          </Text>
          <Text
            style={[styles.summaryValue, { color: themeColors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {isBalanceHidden ? '••••' : `-${formatCurrency(stats.outflow, accountCurrency)}`}
          </Text>
        </View>

        <View style={[styles.summaryDivider, { backgroundColor: themeColors.hairline }]} />

        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: themeColors.textMuted }]}>
            {stats.count} ENTRIES
          </Text>
          <Text
            style={[
              styles.summaryValue,
              { color: stats.net >= 0 ? themeColors.success : themeColors.error },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {isBalanceHidden
              ? '••••'
              : `${stats.net >= 0 ? '+' : ''}${formatCurrency(stats.net, accountCurrency)}`}
          </Text>
        </View>
      </View>

      {/* 3. Chronological Activity Timeline */}
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
        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={themeColors.text} size="small" />
          </View>
        ) : chronologicalGroups.length === 0 ? (
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
              No transactions match your active filters.
            </Text>
          </View>
        ) : (
          chronologicalGroups.map((group) => (
            <View key={group.label} style={styles.timelineGroup}>
              {/* Micro-Caps Date Header */}
              <View style={styles.dateHeaderRow}>
                <Text style={[styles.dateHeaderLabel, { color: themeColors.textMuted }]}>
                  {group.label}
                </Text>
              </View>

              {/* Transactions Container with 1px hairpins */}
              <View
                style={[
                  styles.timelineCard,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.cardBorder,
                  },
                ]}
              >
                {group.items.map((tx, idx) => {
                  const isLast = idx === group.items.length - 1;
                  const isTransfer = tx.type === 'transfer' || !!tx.destinationWalletId;
                  const isIncome = tx.type === 'income';
                  const baseAmount = tx.convertedAmount ?? tx.amount;
                  const hasForeignCurrency =
                    tx.currency && tx.currency !== accountCurrency && tx.originalAmount;

                  return (
                    <TouchableOpacity
                      key={tx.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        triggerHaptic('selection');
                        navigation.navigate('TransactionDetails', { transactionId: tx.id });
                      }}
                      style={[
                        styles.txItemRow,
                        !isLast && {
                          borderBottomWidth: 1,
                          borderBottomColor: themeColors.hairline,
                        },
                      ]}
                    >
                      {/* Left: Category or Transfer Badge */}
                      <View
                        style={[
                          styles.categoryBadge,
                          {
                            backgroundColor: themeColors.background,
                            borderColor: themeColors.hairline,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            isTransfer
                              ? 'swap-vertical'
                              : tx.category?.icon || (isIncome ? 'arrow-down-left' : 'arrow-up-right')
                          }
                          size={16}
                          color={isIncome ? themeColors.success : themeColors.text}
                        />
                      </View>

                      {/* Middle: Title & Meta */}
                      <View style={styles.txMetaColumn}>
                        <Text
                          style={[styles.txTitle, { color: themeColors.text }]}
                          numberOfLines={1}
                        >
                          {tx.description || tx.category?.name || (isTransfer ? 'Transfer' : 'Transaction')}
                        </Text>
                        <View style={styles.txSubRow}>
                          <Text style={[styles.txWalletTag, { color: themeColors.textMuted }]}>
                            {tx.walletName || 'Wallet'}
                            {isTransfer && tx.destinationWalletName
                              ? ` → ${tx.destinationWalletName}`
                              : ''}
                          </Text>
                          {tx.isRecurring && (
                            <View
                              style={[
                                styles.recurringDot,
                                { backgroundColor: themeColors.textMuted },
                              ]}
                            />
                          )}
                        </View>
                      </View>

                      {/* Right: Dual Tabular Amounts */}
                      <View style={styles.txAmountColumn}>
                        <Text
                          style={[
                            styles.primaryAmountText,
                            {
                              color: isTransfer
                                ? themeColors.text
                                : isIncome
                                ? themeColors.success
                                : themeColors.text,
                            },
                          ]}
                        >
                          {isBalanceHidden
                            ? '••••'
                            : `${isTransfer ? '⇄ ' : isIncome ? '+' : '-'}${formatCurrency(baseAmount, accountCurrency)}`}
                        </Text>

                        {/* Dual Currency Subtitle */}
                        {hasForeignCurrency && !isBalanceHidden && (
                          <Text style={[styles.foreignSubtext, { color: themeColors.textMuted }]}>
                            {formatCurrency(tx.originalAmount!, tx.currency)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSuper: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddBtn: {
    borderWidth: 0,
  },
  filterHeader: {
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  filterChipsScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  chipDivider: {
    width: 1,
    height: 16,
    marginHorizontal: 4,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summaryDivider: {
    width: 1,
    height: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    padding: 28,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  timelineGroup: {
    marginBottom: 18,
  },
  dateHeaderRow: {
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  dateHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timelineCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
  },
  txItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryBadge: {
    width: 32,
    height: 32,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txMetaColumn: {
    flex: 1,
    marginRight: 10,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  txSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txWalletTag: {
    fontSize: 11,
    fontWeight: '500',
  },
  recurringDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  txAmountColumn: {
    alignItems: 'flex-end',
  },
  primaryAmountText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  foreignSubtext: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
});
