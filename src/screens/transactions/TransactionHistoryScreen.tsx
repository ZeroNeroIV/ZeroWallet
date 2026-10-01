/**
 * Purpose: Redesigned transaction history with Airy Minimalist Bento layout,
 * generous spacing, search, type and month filters, monthly summary, list + calendar views.
 *
 * Inputs:
 *   - None (navigation screen)
 *
 * Outputs:
 *   - Returns (JSX.Element): Filterable history with working add/edit/delete
 *
 * Side effects:
 *   - Loads transactions + categories from database on focus
 *   - Navigates to add/edit/details screens
 *   - Deletes transactions and reverses their balance effect
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Alert,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TransactionItem } from '../../components/transactions/TransactionItem';
import { QuickAddSheet, type QuickAddAction } from '../../components/navigation/QuickAddSheet';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { MainStackParamList } from '../../types/navigation';
import type { Transaction, Category } from '../../types/models';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { formatCurrency } from '../../constants/currencies';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';

type Nav = StackNavigationProp<MainStackParamList, 'TransactionHistory'>;

interface TransactionWithCategory extends Transaction {
  category: Category;
}

type Row =
  | { type: 'header'; label: string; dailyNet: number; key: string }
  | { type: 'item'; tx: TransactionWithCategory; key: string };

type TypeFilter = 'all' | 'income' | 'expense';

// Helpers
const toDateKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const TransactionHistoryScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { currentAccountId, currentUser } = useAuthStore();
  const { addToVault, subtractFromVault } = useVaultStore();
  const themeColors = useThemeColors();

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [view, setView] = useState<'list' | 'calendar'>('list');

  // filters
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [monthFilter, setMonthFilter] = useState<{ year: number; month: number } | null>(null);

  // calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(Date.now()));

  const transactionRepo = useMemo(() => new TransactionRepository(), []);
  const categoryRepo = useMemo(() => new CategoryRepository(), []);
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Load transactions
  const loadTransactions = async () => {
    if (!currentAccountId || !currentUser) return;
    try {
      setLoading(true);
      const all = await transactionRepo.findByAccount(currentAccountId);
      const cats = await categoryRepo.findByUser(currentUser.id);

      const withCat: TransactionWithCategory[] = all.map((t) => {
        const cat = cats.find((c: Category) => c.id === t.categoryId);
        return {
          ...t,
          category: cat ?? {
            id: t.categoryId,
            userId: currentUser.id,
            name: 'General',
            type: t.type,
            icon: 'help-circle-outline',
            color: '#888888',
            isDefault: false,
            createdAt: 0,
          },
        };
      });

      withCat.sort((a, b) => b.date - a.date);
      setTransactions(withCat);

      try {
        const { AccountRepository } = await import('../../database/repositories/AccountRepository');
        const acc = await new AccountRepository().findById(currentAccountId);
        if (acc) setAccountCurrency(acc.currency);
      } catch (err) {
        console.warn('[TransactionHistoryScreen] Could not load currency:', err);
      }
    } catch {
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [currentAccountId])
  );

  const balanceAmountOf = (t: TransactionWithCategory) => t.convertedAmount || t.amount;

  const handleDelete = async (t: TransactionWithCategory) => {
    try {
      await transactionRepo.delete(t.id);
      const amt = balanceAmountOf(t);
      if (t.type === 'income') {
        subtractFromVault(t.vaultType, amt);
      } else {
        addToVault(t.vaultType, amt);
      }
      await loadTransactions();
      Alert.alert('Success', 'Transaction deleted');
    } catch {
      Alert.alert('Error', 'Failed to delete transaction');
    }
  };

  const handlePress = (t: TransactionWithCategory) =>
    navigation.navigate('TransactionDetails', { transactionId: t.id });

  const handleEdit = (t: TransactionWithCategory) =>
    navigation.navigate('AddTransaction', { transactionId: t.id });

  const handleAdd = (initialDate?: number) => {
    navigation.navigate('AddTransaction', initialDate ? { initialDate } : {});
  };

  const handleQuickAdd = (action: QuickAddAction) => {
    setShowQuickAdd(false);
    if (action === 'transfer') {
      navigation.navigate('Transfer');
      return;
    }
    const initialDate = view === 'calendar' ? selectedDateTimestamp : undefined;
    navigation.navigate(
      'AddTransaction',
      initialDate ? { type: action, initialDate } : { type: action }
    );
  };

  // Filtered transactions
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (monthFilter) {
        const d = new Date(t.date);
        if (d.getFullYear() !== monthFilter.year || d.getMonth() !== monthFilter.month) return false;
      }
      if (q) {
        const haystack = `${t.description || ''} ${t.category.name} ${t.amount}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, query, typeFilter, monthFilter]);

  // Overall summary for current filter
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      const amt = balanceAmountOf(t);
      if (t.type === 'income') income += amt;
      else expense += amt;
    }
    return { income, expense, net: income - expense, count: filtered.length };
  }, [filtered]);

  // List view rows with daily net calculation
  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    const dateGroups = new Map<string, TransactionWithCategory[]>();

    for (const t of filtered) {
      const label = new Date(t.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!dateGroups.has(label)) {
        dateGroups.set(label, []);
      }
      dateGroups.get(label)!.push(t);
    }

    for (const [label, txs] of dateGroups.entries()) {
      const dailyNet = txs.reduce((acc, t) => {
        const amt = balanceAmountOf(t);
        return t.type === 'income' ? acc + amt : acc - amt;
      }, 0);

      result.push({ type: 'header', label, dailyNet, key: `h-${label}` });
      for (const t of txs) {
        result.push({ type: 'item', tx: t, key: `t-${t.id}` });
      }
    }
    return result;
  }, [filtered]);

  const stickyIndices = useMemo(() => {
    const indices: number[] = [];
    rows.forEach((r, i) => {
      if (r.type === 'header') indices.push(i);
    });
    return indices;
  }, [rows]);

  // Calendar view data
  const txByDate = useMemo(() => {
    const map = new Map<string, TransactionWithCategory[]>();
    for (const t of transactions) {
      const k = toDateKey(t.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return map;
  }, [transactions]);

  const selectedTxs = useMemo(
    () => txByDate.get(selectedDate) ?? [],
    [txByDate, selectedDate]
  );

  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const total = new Date(calYear, calMonth + 1, 0).getDate();
    return { first, total };
  }, [calYear, calMonth]);

  const shiftCalMonth = (delta: number) => {
    const next = new Date(calYear, calMonth + delta, 1);
    setCalYear(next.getFullYear());
    setCalMonth(next.getMonth());
  };

  const shiftFilterMonth = (delta: number) => {
    if (!monthFilter) {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth() + delta, 1);
      setMonthFilter({ year: next.getFullYear(), month: next.getMonth() });
      return;
    }
    const next = new Date(monthFilter.year, monthFilter.month + delta, 1);
    setMonthFilter({ year: next.getFullYear(), month: next.getMonth() });
  };

  const monthFilterLabel = monthFilter
    ? `${MONTHS[monthFilter.month]} ${monthFilter.year}`
    : 'All Time';

  const formattedSelected = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  const selectedDateTimestamp = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
  }, [selectedDate]);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.type === 'header') {
      const isPositive = item.dailyNet >= 0;
      return (
        <View style={styles.dateHeader}>
          <Text style={styles.dateText}>{item.label}</Text>
          <Text style={[styles.dailyNetText, isPositive ? styles.incomeText : styles.expenseText]}>
            {isPositive ? '+' : ''}{formatCurrency(item.dailyNet, accountCurrency)}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.itemWrap}>
        <TransactionItem
          transaction={item.tx}
          category={item.tx.category}
          onPress={() => handlePress(item.tx)}
          onEdit={() => handleEdit(item.tx)}
          onDelete={() => handleDelete(item.tx)}
          accountCurrency={accountCurrency}
        />
      </View>
    );
  };

  const renderTypeChip = (value: TypeFilter, label: string, icon: string) => {
    const active = typeFilter === value;
    return (
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => {
          lightHaptic();
          setTypeFilter(value);
        }}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={16}
          color={active ? themeColors.onPrimary : themeColors.textSecondary}
        />
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderCalendar = () => {
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < calDays.first; i++) {
      cells.push(<View key={`blank-${i}`} style={styles.calCell} />);
    }

    for (let d = 1; d <= calDays.total; d++) {
      const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasTx = txByDate.has(key);
      const isSelected = key === selectedDate;
      const isToday = key === toDateKey(Date.now());

      cells.push(
        <TouchableOpacity
          key={key}
          style={[
            styles.calCell,
            isSelected && { backgroundColor: themeColors.primary },
            isToday && !isSelected && styles.calToday,
          ]}
          onPress={() => {
            lightHaptic();
            setSelectedDate(key);
          }}
        >
          <Text
            style={[
              styles.calDayNum,
              isSelected && { color: themeColors.onPrimary, fontWeight: '700' },
              isToday && !isSelected && { color: themeColors.primary, fontWeight: '700' },
            ]}
          >
            {d}
          </Text>
          {hasTx && (
            <View
              style={[
                styles.calDot,
                isSelected ? { backgroundColor: themeColors.onPrimary } : { backgroundColor: themeColors.primary },
              ]}
            />
          )}
        </TouchableOpacity>
      );
    }

    const calRows: React.ReactNode[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      calRows.push(
        <View key={i} style={styles.calRow}>
          {cells.slice(i, i + 7)}
        </View>
      );
    }
    return calRows;
  };

  return (
    <View style={styles.container}>
      {/* Bento Summary Card */}
      <View style={styles.summaryBento}>
        <View style={styles.summaryTopRow}>
          <View>
            <Text style={styles.summarySubtitle}>NET CASHFLOW</Text>
            <Text
              style={[
                styles.summaryNetValue,
                summary.net >= 0 ? styles.incomeText : styles.expenseText,
              ]}
            >
              {summary.net >= 0 ? '+' : ''}{formatCurrency(summary.net, accountCurrency)}
            </Text>
          </View>
          <View style={styles.txCountBadge}>
            <MaterialCommunityIcons name="swap-horizontal" size={14} color={themeColors.textSecondary} />
            <Text style={styles.txCountText}>{summary.count} txns</Text>
          </View>
        </View>

        <View style={styles.summarySubgrid}>
          <View style={styles.summarySubItem}>
            <View style={styles.summaryDotIncome} />
            <View>
              <Text style={styles.subItemLabel}>Income</Text>
              <Text style={[styles.subItemValue, styles.incomeText]}>
                +{formatCurrency(summary.income, accountCurrency)}
              </Text>
            </View>
          </View>

          <View style={styles.summarySubDivider} />

          <View style={styles.summarySubItem}>
            <View style={styles.summaryDotExpense} />
            <View>
              <Text style={styles.subItemLabel}>Expenses</Text>
              <Text style={[styles.subItemValue, styles.expenseText]}>
                -{formatCurrency(summary.expense, accountCurrency)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* View Switcher & Month Navigation */}
      <View style={styles.controlsRow}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'list' && styles.toggleActive]}
            onPress={() => {
              lightHaptic();
              setView('list');
            }}
          >
            <MaterialCommunityIcons
              name="format-list-bulleted"
              size={18}
              color={view === 'list' ? themeColors.onPrimary : themeColors.textSecondary}
            />
            <Text style={[styles.toggleLabel, view === 'list' && styles.toggleLabelActive]}>
              List
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, view === 'calendar' && styles.toggleActive]}
            onPress={() => {
              lightHaptic();
              setView('calendar');
            }}
          >
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={18}
              color={view === 'calendar' ? themeColors.onPrimary : themeColors.textSecondary}
            />
            <Text style={[styles.toggleLabel, view === 'calendar' && styles.toggleLabelActive]}>
              Calendar
            </Text>
          </TouchableOpacity>
        </View>

        {view === 'list' && (
          <View style={styles.monthNavInline}>
            <TouchableOpacity onPress={() => shiftFilterMonth(-1)} style={styles.monthArrow} hitSlop={8}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={themeColors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMonthFilter(null)} activeOpacity={0.7}>
              <Text style={styles.monthText}>{monthFilterLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => shiftFilterMonth(1)} style={styles.monthArrow} hitSlop={8}>
              <MaterialCommunityIcons name="chevron-right" size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* Search bar */}
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={22} color={themeColors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search description, category, amount…"
              placeholderTextColor={themeColors.textMuted}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Type filter chips */}
          <View style={styles.chipRow}>
            {renderTypeChip('all', 'All', 'view-list')}
            {renderTypeChip('income', 'Income', 'arrow-down-circle-outline')}
            {renderTypeChip('expense', 'Expenses', 'arrow-up-circle-outline')}
          </View>

          {/* FlashList */}
          <View style={styles.listWrap}>
            <FlashList
              data={rows}
              renderItem={renderRow}
              keyExtractor={(item) => item.key}
              stickyHeaderIndices={stickyIndices}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadTransactions();
                  }}
                  tintColor={themeColors.primary}
                />
              }
              ListEmptyComponent={
                !loading ? (
                  <View style={styles.empty}>
                    <View style={styles.emptyIconCircle}>
                      <MaterialCommunityIcons
                        name={query || typeFilter !== 'all' || monthFilter ? 'magnify-close' : 'receipt-outline'}
                        size={44}
                        color={themeColors.textMuted}
                      />
                    </View>
                    <Text style={styles.emptyTitle}>
                      {query || typeFilter !== 'all' || monthFilter ? 'No Matches Found' : 'No Transactions Yet'}
                    </Text>
                    <Text style={styles.emptyText}>
                      {query || typeFilter !== 'all' || monthFilter
                        ? 'Try clearing your search or filter pills'
                        : 'Tap the + button to record your first transaction'}
                    </Text>
                  </View>
                ) : null
              }
            />
          </View>
        </>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === 'calendar' && (
        <ScrollView style={styles.calendarScrollView} contentContainerStyle={styles.calendarScrollContent}>
          {/* Calendar Month Navigation */}
          <View style={styles.calMonthNav}>
            <TouchableOpacity onPress={() => shiftCalMonth(-1)} style={styles.navArrow} hitSlop={8}>
              <MaterialCommunityIcons name="chevron-left" size={26} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>
              {MONTHS[calMonth]} {calYear}
            </Text>
            <TouchableOpacity onPress={() => shiftCalMonth(1)} style={styles.navArrow} hitSlop={8}>
              <MaterialCommunityIcons name="chevron-right" size={26} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={styles.calRow}>
            {DAYS.map((d) => (
              <View key={d} style={styles.calCell}>
                <Text style={styles.calDayLabel}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calGridContainer}>{renderCalendar()}</View>

          {/* Selected day transactions */}
          <View style={styles.selectedSection}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedDateLabel}>{formattedSelected}</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => handleAdd(selectedDateTimestamp)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus" size={18} color={themeColors.onPrimary} />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {selectedTxs.length === 0 ? (
              <View style={styles.noTxForDay}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={themeColors.textMuted} />
                <Text style={styles.noTxText}>No transactions recorded on this day</Text>
              </View>
            ) : (
              selectedTxs.map((t) => (
                <View key={t.id} style={styles.itemWrap}>
                  <TransactionItem
                    transaction={t}
                    category={t.category}
                    onPress={() => handlePress(t)}
                    onEdit={() => handleEdit(t)}
                    onDelete={() => handleDelete(t)}
                    accountCurrency={accountCurrency}
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          mediumHaptic();
          setShowQuickAdd(true);
        }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color={themeColors.onPrimary} />
      </TouchableOpacity>

      <QuickAddSheet
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSelect={handleQuickAdd}
      />
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    // Bento Summary Card
    summaryBento: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: 20,
      backgroundColor: themeColors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    summaryTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    summarySubtitle: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    summaryNetValue: {
      fontSize: 26,
      fontWeight: '800',
    },
    txCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: borderRadius.round,
      backgroundColor: themeColors.surfaceHighlight,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    txCountText: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.textSecondary,
    },
    summarySubgrid: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: themeColors.cardBorder,
    },
    summarySubItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    summaryDotIncome: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: themeColors.incomeGreen,
    },
    summaryDotExpense: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: themeColors.expenseRed,
    },
    subItemLabel: {
      ...typography.caption,
      color: themeColors.textMuted,
      fontWeight: '600',
    },
    subItemValue: {
      fontSize: 15,
      fontWeight: '700',
      marginTop: 2,
    },
    summarySubDivider: {
      width: 1,
      height: 32,
      backgroundColor: themeColors.cardBorder,
      marginHorizontal: 12,
    },
    incomeText: {
      color: themeColors.incomeGreen,
    },
    expenseText: {
      color: themeColors.expenseRed,
    },
    // Controls Row
    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      gap: 12,
    },
    toggleRow: {
      flexDirection: 'row',
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.round,
      padding: 3,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    toggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: borderRadius.round,
      gap: 6,
    },
    toggleActive: {
      backgroundColor: themeColors.primary,
    },
    toggleLabel: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.textSecondary,
    },
    toggleLabelActive: {
      color: themeColors.onPrimary,
    },
    monthNavInline: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: borderRadius.round,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      gap: 4,
    },
    monthArrow: {
      padding: 2,
    },
    monthText: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.text,
      paddingHorizontal: 4,
    },
    // Search
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      gap: 10,
    },
    searchInput: {
      ...typography.body,
      flex: 1,
      color: themeColors.text,
      paddingVertical: 0,
    },
    // Filter Chips
    chipRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: borderRadius.round,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      gap: 6,
    },
    chipActive: {
      backgroundColor: themeColors.primary,
      borderColor: themeColors.primary,
    },
    chipText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    chipTextActive: {
      color: themeColors.onPrimary,
      fontWeight: '700',
    },
    // List
    listWrap: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 90,
    },
    itemWrap: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 4,
    },
    dateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: themeColors.background,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    dateText: {
      fontSize: 12,
      fontWeight: '800',
      color: themeColors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    dailyNetText: {
      fontSize: 12,
      fontWeight: '700',
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      paddingHorizontal: spacing.xl,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: themeColors.surfaceHighlight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      ...typography.h3,
      color: themeColors.text,
      marginBottom: 6,
    },
    emptyText: {
      ...typography.body,
      color: themeColors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    // FAB
    fab: {
      position: 'absolute',
      bottom: spacing.lg,
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: themeColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    // Calendar
    calendarScrollView: {
      flex: 1,
      marginTop: spacing.sm,
    },
    calendarScrollContent: {
      paddingBottom: 90,
    },
    calMonthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    calMonthLabel: {
      ...typography.h3,
      color: themeColors.text,
      fontWeight: '800',
    },
    navArrow: {
      padding: spacing.xs,
    },
    calGridContainer: {
      paddingHorizontal: spacing.md,
      marginTop: spacing.xs,
    },
    calRow: {
      flexDirection: 'row',
    },
    calCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 12,
      minHeight: 46,
      justifyContent: 'center',
      margin: 2,
    },
    calToday: {
      borderWidth: 1.5,
      borderColor: themeColors.primary,
    },
    calDayLabel: {
      ...typography.caption,
      color: themeColors.textMuted,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 4,
    },
    calDayNum: {
      fontSize: 14,
      color: themeColors.text,
      fontWeight: '600',
    },
    calDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      marginTop: 3,
    },
    selectedSection: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: themeColors.cardBorder,
    },
    selectedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    selectedDateLabel: {
      ...typography.body,
      color: themeColors.text,
      fontWeight: '700',
      flex: 1,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: borderRadius.round,
      gap: 4,
    },
    addBtnText: {
      ...typography.caption,
      color: themeColors.onPrimary,
      fontWeight: '700',
    },
    noTxForDay: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.xs,
    },
    noTxText: {
      ...typography.bodySmall,
      color: themeColors.textMuted,
    },
  });
