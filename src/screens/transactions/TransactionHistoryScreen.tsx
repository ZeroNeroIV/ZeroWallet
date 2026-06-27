import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Alert,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TransactionItem } from '../../components/transactions/TransactionItem';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { borderRadius } from '../../theme/spacing';
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
      const withCat: TransactionWithCategory[] = all
        .map(t => {
          const cat = cats.find((c: Category) => c.id === t.categoryId);
          return cat ? { ...t, category: cat } : null;
        })
        .filter((t): t is TransactionWithCategory => t !== null);

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

  const handleDelete = async (t: TransactionWithCategory) => {
    try {
      await transactionRepo.delete(t.id);
      const amt = t.convertedAmount || t.amount;
      t.type === 'income' ? subtractFromVault(t.vaultType, amt) : addToVault(t.vaultType, amt);
      await loadTransactions();
      Alert.alert('Success', 'Transaction deleted');
    } catch {
      Alert.alert('Error', 'Failed to delete transaction');
    }
  };

  const handlePress = (t: TransactionWithCategory) =>
    navigation.navigate('TransactionDetails', { transactionId: t.id });

  const handleAdd = (dateStr?: string) => {
    navigation.navigate('AddTransaction', {});
  };

  // ── list view data ────────────────────────────────────────────────────────

  const groupedData = useMemo(() => {
    const result: Array<{ type: 'header'; label: string } | { type: 'item'; tx: TransactionWithCategory }> = [];
    let lastDate = '';
    for (const t of transactions) {
      const label = new Date(t.date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      if (label !== lastDate) {
        result.push({ type: 'header', label });
        lastDate = label;
      }
      result.push({ type: 'item', tx: t });
    }
    return result;
  }, [transactions]);

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

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  // ── render helpers ────────────────────────────────────────────────────────

  const renderListItem = ({ item }: { item: typeof groupedData[0] }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.dateHeader}>
          <Text style={styles.dateText}>{item.label}</Text>
        </View>
      );
    }
    return (
      <TransactionItem
        transaction={item.tx}
        category={item.tx.category}
        onPress={() => handlePress(item.tx)}
        onEdit={() => {}}
        onDelete={() => handleDelete(item.tx)}
        accountCurrency={accountCurrency}
      />
    );
  };

  const renderCalendar = () => {
    const cells: React.ReactNode[] = [];

    // blank cells before first day
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

    // group into rows of 7
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

  // ── main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

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
        <FlatList
          data={groupedData}
          renderItem={renderListItem}
          keyExtractor={(item, i) =>
            item.type === 'header' ? `h-${item.label}` : `t-${item.tx.id}`
          }
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
                <MaterialCommunityIcons name="receipt" size={48} color={themeColors.textSecondary} />
                <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                <Text style={styles.emptyText}>Tap + to add your first transaction</Text>
              </View>
            ) : null
          }
          contentContainerStyle={groupedData.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === 'calendar' && (
        <ScrollView style={{ flex: 1 }}>
          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navArrow}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[calMonth]} {calYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navArrow}>
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
                onPress={() => handleAdd(selectedDate)}
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
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  category={t.category}
                  onPress={() => handlePress(t)}
                  onEdit={() => {}}
                  onDelete={() => handleDelete(t)}
                  accountCurrency={accountCurrency}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* FAB for list view */}
      {view === 'list' && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: themeColors.primary }]} onPress={() => handleAdd()}>
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── styles ──────────────────────────────────────────────────────────────────

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },

    // toggle
    toggleRow: {
      flexDirection: 'row',
      margin: spacing.md,
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

    // list view
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
    emptyContainer: { flex: 1 },
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
