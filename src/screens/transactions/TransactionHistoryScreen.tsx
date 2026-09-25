/**
 * Purpose: Redesigned transaction history with search, filters, monthly
 * summary, list + calendar views
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
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TransactionItem } from '../../components/transactions/TransactionItem';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { MainStackParamList } from '../../types/navigation';
import { Transaction, Category } from '../../types/models';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';

type Nav = StackNavigationProp<MainStackParamList, 'TransactionHistory'>;

interface TransactionWithCategory extends Transaction {
  category: Category;
}

type Row =
  | { type: 'header'; label: string; key: string }
  | { type: 'item'; tx: TransactionWithCategory; key: string };

type TypeFilter = 'all' | 'income' | 'expense';

// ─── helpers ────────────────────────────────────────────────────────────────

const toDateKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── component ──────────────────────────────────────────────────────────────

export const TransactionHistoryScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { currentAccountId, currentUser } = useAuthStore();
  const { addToVault, subtractFromVault } = useVaultStore();
  const themeColors = useThemeColors();

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
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

  // ── data ──────────────────────────────────────────────────────────────────

  useFocusEffect(useCallback(() => { loadTransactions(); }, [currentAccountId]));

  const loadTransactions = async () => {
    if (!currentAccountId || !currentUser) return;
    try {
      setLoading(true);
      const all = await transactionRepo.findByAccount(currentAccountId);
      const cats = await categoryRepo.findByUser(currentUser.id);
      // Never hide transactions: orphaned category ids (e.g. from an old
      // backup) render under an Unknown placeholder instead of vanishing
      const withCat: TransactionWithCategory[] = all.map(t => {
        const cat = cats.find((c: Category) => c.id === t.categoryId);
        return {
          ...t,
          category: cat ?? {
            id: t.categoryId,
            userId: currentUser.id,
            name: 'Unknown',
            type: t.type,
            icon: 'help-circle',
            color: '#999',
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
      } catch {}
    } catch {
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  const formatMoney = useCallback((value: number) => {
    const formatted = Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    return accountCurrency === 'USD' ? `$${formatted}` : `${formatted} ${accountCurrency}`;
  }, [accountCurrency]);

  // ── filtering + summary ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter(t => {
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

  // ── list view rows ────────────────────────────────────────────────────────

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    let lastDate = '';
    for (const t of filtered) {
      const label = new Date(t.date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      if (label !== lastDate) {
        result.push({ type: 'header', label, key: `h-${label}` });
        lastDate = label;
      }
      result.push({ type: 'item', tx: t, key: `t-${t.id}` });
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

  // ── calendar view data ────────────────────────────────────────────────────

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
    : 'All time';

  // ── render helpers ────────────────────────────────────────────────────────

  const renderRow = ({ item }: { item: Row }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.dateHeader}>
          <Text style={styles.dateText}>{item.label}</Text>
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
        onPress={() => setTypeFilter(value)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={16}
          color={active ? '#fff' : themeColors.textSecondary}
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
          onPress={() => setSelectedDate(key)}
        >
          <Text style={[
            styles.calDayNum,
            isSelected && { color: '#fff' },
            isToday && !isSelected && { color: themeColors.primary },
          ]}>
            {d}
          </Text>
          {hasTx && (
            <View style={[styles.calDot, isSelected && { backgroundColor: '#fff' }]} />
          )}
        </TouchableOpacity>
      );
    }

    const rows: React.ReactNode[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(
        <View key={i} style={styles.calRow}>
          {cells.slice(i, i + 7)}
        </View>
      );
    }
    return rows;
  };

  const formattedSelected = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }, [selectedDate]);

  const selectedDateTimestamp = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
  }, [selectedDate]);

  // ── main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryValue, styles.incomeText]}>+{formatMoney(summary.income)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={[styles.summaryValue, styles.expenseText]}>-{formatMoney(summary.expense)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Net ({summary.count})</Text>
          <Text style={[
            styles.summaryValue,
            summary.net >= 0 ? styles.incomeText : styles.expenseText,
          ]}>
            {summary.net >= 0 ? '+' : '-'}{formatMoney(summary.net)}
          </Text>
        </View>
      </View>

      {/* View toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'list' && styles.toggleActive]}
          onPress={() => setView('list')}
        >
          <MaterialCommunityIcons
            name="format-list-bulleted"
            size={18}
            color={view === 'list' ? '#fff' : themeColors.textSecondary}
          />
          <Text style={[styles.toggleLabel, view === 'list' && styles.toggleLabelActive]}>
            List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, view === 'calendar' && styles.toggleActive]}
          onPress={() => setView('calendar')}
        >
          <MaterialCommunityIcons
            name="calendar-month"
            size={18}
            color={view === 'calendar' ? '#fff' : themeColors.textSecondary}
          />
          <Text style={[styles.toggleLabel, view === 'calendar' && styles.toggleLabelActive]}>
            Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <>
          {/* Search */}
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search description, category, amount…"
              placeholderTextColor={themeColors.textSecondary}
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
            {renderTypeChip('income', 'Income', 'arrow-down-bold')}
            {renderTypeChip('expense', 'Expenses', 'arrow-up-bold')}
          </View>

          {/* Month filter */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => shiftFilterMonth(-1)} style={styles.monthArrow} hitSlop={8}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={themeColors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMonthFilter(null)} activeOpacity={0.7}>
              <Text style={styles.monthText}>{monthFilterLabel}</Text>
              {monthFilter && <Text style={styles.monthReset}>Tap for all time</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => shiftFilterMonth(1)} style={styles.monthArrow} hitSlop={8}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.listWrap}>
            <FlashList
              data={rows}
              renderItem={renderRow}
              keyExtractor={(item) => item.key}
              estimatedItemSize={86}
              stickyHeaderIndices={stickyIndices}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); loadTransactions(); }}
                  tintColor={themeColors.primary}
                />
              }
              ListEmptyComponent={
                !loading ? (
                  <View style={styles.empty}>
                    <MaterialCommunityIcons
                      name={query || typeFilter !== 'all' || monthFilter ? 'magnify-close' : 'receipt'}
                      size={48}
                      color={themeColors.textSecondary}
                    />
                    <Text style={styles.emptyTitle}>
                      {query || typeFilter !== 'all' || monthFilter ? 'No Matches' : 'No Transactions Yet'}
                    </Text>
                    <Text style={styles.emptyText}>
                      {query || typeFilter !== 'all' || monthFilter
                        ? 'Try a different search or filter'
                        : 'Tap + to add your first transaction'}
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
        <ScrollView style={{ flex: 1 }}>
          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => shiftCalMonth(-1)} style={styles.navArrow}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity onPress={() => shiftCalMonth(1)} style={styles.navArrow}>
              <MaterialCommunityIcons name="chevron-right" size={28} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={styles.calRow}>
            {DAYS.map(d => (
              <View key={d} style={styles.calCell}>
                <Text style={styles.calDayLabel}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          {renderCalendar()}

          {/* Selected date transactions */}
          <View style={styles.selectedSection}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedDateLabel}>{formattedSelected}</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => handleAdd(selectedDateTimestamp)}
              >
                <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {selectedTxs.length === 0 ? (
              <View style={styles.noTxForDay}>
                <MaterialCommunityIcons name="calendar-blank" size={32} color={themeColors.textSecondary} />
                <Text style={styles.noTxText}>No transactions on this day</Text>
              </View>
            ) : (
              selectedTxs.map(t => (
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

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: themeColors.primary }]}
        onPress={() => handleAdd(view === 'calendar' ? selectedDateTimestamp : undefined)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

// ─── styles ──────────────────────────────────────────────────────────────────

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },

    // summary
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    summaryCol: { flex: 1, alignItems: 'center', gap: 2 },
    summaryLabel: { ...typography.caption, color: themeColors.textSecondary, fontWeight: '600' },
    summaryValue: { ...typography.body, fontWeight: '700', color: themeColors.text },
    incomeText: { color: themeColors.success },
    expenseText: { color: themeColors.error },
    summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: themeColors.border },

    // search
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors.border,
      gap: spacing.sm,
    },
    searchInput: {
      ...typography.body,
      flex: 1,
      color: themeColors.text,
      paddingVertical: 0,
    },

    // chips
    chipRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.round,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
      gap: 4,
    },
    chipActive: {
      backgroundColor: themeColors.primary,
      borderColor: themeColors.primary,
    },
    chipText: { ...typography.bodySmall, color: themeColors.textSecondary, fontWeight: '600' },
    chipTextActive: { color: '#fff' },

    // month filter
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    monthArrow: { padding: spacing.xs },
    monthText: { ...typography.body, color: themeColors.text, fontWeight: '700', textAlign: 'center' },
    monthReset: { ...typography.caption, color: themeColors.primary, textAlign: 'center' },

    // list
    listWrap: { flex: 1 },
    itemWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },

    // toggle
    toggleRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.md,
      padding: 4,
      gap: 4,
    },
    toggleBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.sm,
      gap: spacing.xs,
    },
    toggleActive: { backgroundColor: themeColors.primary },
    toggleLabel: { ...typography.bodySmall, color: themeColors.textSecondary, fontWeight: '600' },
    toggleLabelActive: { color: '#fff' },

    // sticky date headers
    dateHeader: {
      backgroundColor: themeColors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    dateText: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.sm },
    emptyTitle: { ...typography.h3, color: themeColors.text },
    emptyText: { ...typography.body, color: themeColors.textSecondary, textAlign: 'center' },

    // FAB
    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
    },

    // calendar
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    monthLabel: { ...typography.h3, color: themeColors.text, fontWeight: '700' },
    navArrow: { padding: spacing.xs },
    calRow: { flexDirection: 'row' },
    calCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
    calToday: { borderWidth: 1, borderColor: themeColors.primary },
    calDayLabel: { ...typography.caption, color: themeColors.textSecondary, fontWeight: '600' },
    calDayNum: { ...typography.body, color: themeColors.text, fontWeight: '500' },
    calDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: themeColors.primary,
      marginTop: 2,
    },

    // selected day section
    selectedSection: {
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: themeColors.border,
      paddingBottom: spacing.xxxl,
    },
    selectedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    selectedDateLabel: { ...typography.body, color: themeColors.text, fontWeight: '600', flex: 1 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
      gap: 4,
    },
    addBtnText: { ...typography.bodySmall, color: '#fff', fontWeight: '600' },
    noTxForDay: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    noTxText: { ...typography.body, color: themeColors.textSecondary },
  });
