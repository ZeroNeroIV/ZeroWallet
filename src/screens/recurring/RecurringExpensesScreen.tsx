/**
 * Purpose: Displays all recurring expenses with active/inactive status and manual trigger option
 * 
 * Inputs:
 *   - None (navigation screen)
 * 
 * Outputs:
 *   - Returns (JSX.Element): Recurring expenses list with add/edit/toggle/trigger actions
 * 
 * Side effects:
 *   - Loads recurring expenses from database on mount and focus
 *   - Navigates to AddRecurring screen
 *   - Toggles recurring expense active/inactive status
 *   - Deletes recurring expenses
 *   - Manually triggers recurring expense (creates transaction)
 *   - Refreshes list
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { useAccountStore } from '../../store/accountStore';
import { useSettingsStore } from '../../store/settingsStore';
import type { RecurringExpense, Category } from '../../types/models';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Button } from '../../components/forms/Button';
import { format } from 'date-fns';
import { useThemeColors } from '../../hooks/useThemeColors';

type RecurringNavigationProp = StackNavigationProp<
  MainStackParamList,
  'RecurringExpenses'
>;

interface RecurringExpenseWithCategory extends RecurringExpense {
  category: Category;
}

export default function RecurringExpensesScreen() {
  const navigation = useNavigation<RecurringNavigationProp>();
  const currentAccountId = useAuthStore((state) => state.currentAccountId);
  const { updateBalance, balances } = useAccountStore();
  const themeColors = useThemeColors();

  const [expenses, setExpenses] = useState<RecurringExpenseWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const loadExpenses = async () => {
    if (!currentAccountId) return;

    try {
      const recurringRepo = new RecurringExpenseRepository();
      const categoryRepo = new CategoryRepository();

      const recurringExpenses = await recurringRepo.findByAccount(currentAccountId);

      // Load category for each expense
      const expensesWithCategories = await Promise.all(
        recurringExpenses.map(async (expense) => {
          const category = await categoryRepo.findById(expense.categoryId);
          return {
            ...expense,
            category: category!,
          };
        })
      );

      setExpenses(expensesWithCategories);
    } catch (error) {
      console.error('[RecurringExpenses] Failed to load expenses:', error);
      Alert.alert('Error', 'Failed to load recurring expenses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [currentAccountId])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  const handleAddExpense = () => {
    navigation.navigate('AddRecurring');
  };

  const handleEditExpense = (expense: RecurringExpense) => {
    navigation.navigate('AddRecurring', {
      mode: 'edit',
      recurringId: expense.id,
    });
  };

  const handleToggleActive = async (expense: RecurringExpense) => {
    try {
      const recurringRepo = new RecurringExpenseRepository();
      await recurringRepo.update(expense.id, {
        isActive: !expense.isActive,
      });
      loadExpenses();
    } catch (error) {
      console.error('[RecurringExpenses] Failed to toggle expense:', error);
      Alert.alert('Error', 'Failed to update recurring expense');
    }
  };

  const handleManualTrigger = async (expense: RecurringExpenseWithCategory) => {
    Alert.alert(
      'Process Expense',
      `Process "${expense.name}" now for $${expense.amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: async () => {
            try {
              const transactionRepo = new TransactionRepository();
              const recurringRepo = new RecurringExpenseRepository();
              const currency = useSettingsStore.getState().appSettings.currency;

              // Create transaction
              await transactionRepo.create({
                accountId: expense.accountId,
                type: 'expense',
                amount: expense.amount,
                categoryId: expense.categoryId,
                vaultType: expense.vaultType,
                description: `${expense.name} (Manual)`,
                date: Date.now(),
                currency,
              });

              // Update balance
              const currentBalance = balances[expense.accountId];
              if (currentBalance) {
                const updates: any = {};
                if (expense.vaultType === 'main') {
                  updates.mainBalance = currentBalance.mainBalance - expense.amount;
                } else if (expense.vaultType === 'savings') {
                  updates.savingsBalance = currentBalance.savingsBalance - expense.amount;
                } else {
                  updates.heldBalance = currentBalance.heldBalance - expense.amount;
                }
                updateBalance(expense.accountId, updates);
              }

              // Update next occurrence
              const nextOccurrence = calculateNextOccurrence(
                expense.frequency,
                expense.interval,
                new Date()
              );
              await recurringRepo.update(expense.id, {
                lastProcessed: Date.now(),
                nextOccurrence,
              });

              Alert.alert('Success', 'Recurring expense processed');
              loadExpenses();
            } catch (error) {
              console.error('[RecurringExpenses] Failed to process expense:', error);
              Alert.alert('Error', 'Failed to process expense');
            }
          },
        },
      ]
    );
  };

  const handleDeleteExpense = (expense: RecurringExpense) => {
    Alert.alert(
      'Delete Recurring Expense',
      `Are you sure you want to delete "${expense.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const recurringRepo = new RecurringExpenseRepository();
              await recurringRepo.delete(expense.id);
              Alert.alert('Success', 'Recurring expense deleted');
              loadExpenses();
            } catch (error) {
              console.error('[RecurringExpenses] Failed to delete expense:', error);
              Alert.alert('Error', 'Failed to delete expense');
            }
          },
        },
      ]
    );
  };

  const calculateNextOccurrence = (
    frequency: string,
    interval: number,
    fromDate: Date
  ): number => {
    const nextDate = new Date(fromDate);

    switch (frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + interval);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + interval * 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + interval);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        break;
    }

    return nextDate.getTime();
  };

  const getFrequencyText = (frequency: string, interval: number): string => {
    if (interval === 1) {
      return frequency.charAt(0).toUpperCase() + frequency.slice(1);
    }
    return `Every ${interval} ${frequency === 'daily' ? 'days' : frequency === 'weekly' ? 'weeks' : frequency === 'monthly' ? 'months' : 'years'}`;
  };

  const renderExpenseItem = ({ item }: { item: RecurringExpenseWithCategory }) => (
    <TouchableOpacity
      style={[
        styles.expenseItem,
        !item.isActive && styles.expenseItemInactive,
      ]}
      onPress={() => handleEditExpense(item)}
      activeOpacity={0.7}
    >
      <View style={styles.expenseLeft}>
        <View style={[styles.iconCircle, { backgroundColor: item.category.color }]}>
          <Icon name={item.category.icon} size={24} color={themeColors.surface} />
        </View>
        <View style={styles.expenseInfo}>
          <Text style={[styles.expenseName, !item.isActive && styles.textInactive]}>
            {item.name}
          </Text>
          <Text style={styles.expenseDetails}>
            ${item.amount.toFixed(2)} • {getFrequencyText(item.frequency, item.interval)}
          </Text>
          <Text style={styles.expenseNext}>
            Next: {format(item.nextOccurrence, 'MMM d, yyyy')}
          </Text>
          {item.autoDeduct && (
            <View style={styles.autoBadge}>
              <Icon name="lightning-bolt" size={12} color={themeColors.warning} />
              <Text style={styles.autoBadgeText}>Auto</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.expenseRight}>
        <TouchableOpacity
          style={styles.triggerButton}
          onPress={() => handleManualTrigger(item)}
        >
          <Icon name="play-circle" size={24} color={themeColors.primary} />
        </TouchableOpacity>
        <Switch
          value={item.isActive}
          onValueChange={() => handleToggleActive(item)}
          trackColor={{
            false: themeColors.neutral.gray300,
            true: themeColors.primary,
          }}
          thumbColor={themeColors.surface}
        />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteExpense(item)}
        >
          <Icon name="delete" size={20} color={themeColors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const activeCount = expenses.filter((e) => e.isActive).length;
  const autoCount = expenses.filter((e) => e.isActive && e.autoDeduct).length;

  return (
    <View style={styles.container}>
      {/* Stats Card */}
      {expenses.length > 0 && (
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{autoCount}</Text>
            <Text style={styles.statLabel}>Auto-Deduct</Text>
          </View>
        </View>
      )}

      {/* Expenses List */}
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpenseItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="clock-outline" size={64} color={themeColors.textSecondary} />
            <Text style={styles.emptyTitle}>No Recurring Expenses</Text>
            <Text style={styles.emptySubtitle}>
              Add expenses that repeat regularly
            </Text>
          </View>
        }
      />

      {/* Add Button */}
      <View style={styles.footer}>
        <Button
          title="Add Recurring Expense"
          onPress={handleAddExpense}
          leftIcon={<Icon name="plus" size={20} color="#FFF" />}
        />
      </View>
    </View>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: themeColors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...{
      shadowColor: themeColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    fontWeight: '700',
    color: themeColors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: themeColors.border,
    marginHorizontal: spacing.lg,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...{
      shadowColor: themeColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  expenseItemInactive: {
    opacity: 0.6,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: {
    flex: 1,
    gap: 4,
  },
  expenseName: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  textInactive: {
    color: themeColors.textSecondary,
  },
  expenseDetails: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  expenseNext: {
    ...typography.caption,
    color: themeColors.primary,
    fontSize: 11,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: themeColors.warning + '20',
    borderRadius: borderRadius.sm,
    gap: 4,
    marginTop: 4,
  },
  autoBadgeText: {
    ...typography.caption,
    color: themeColors.warning,
    fontSize: 10,
    fontWeight: '600',
  },
  expenseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  triggerButton: {
    padding: spacing.xs,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: themeColors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
});
