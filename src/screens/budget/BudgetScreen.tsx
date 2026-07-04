/**
 * Purpose: Monthly per-category budget tracking — set spending caps per expense
 * category and see spend-vs-limit progress for the selected month.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { BudgetService } from '../../services/budgetService';
import { CategoryPicker } from '../../components/forms/CategoryPicker';
import { AmountInput } from '../../components/forms/AmountInput';
import { Button } from '../../components/forms/Button';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency, getCurrencySymbol } from '../../constants/currencies';
import { monthKeyFromDate, shiftMonthKey, formatMonthLabel, getBudgetStatusColor } from '../../utils/budgetUtils';
import type { Category, BudgetProgress } from '../../types/models';

export default function BudgetScreen() {
  const { currentUser, currentAccountId } = useAuthStore();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [month, setMonth] = useState(() => monthKeyFromDate(new Date()));
  const [currency, setCurrency] = useState('USD');
  const [progress, setProgress] = useState<BudgetProgress[]>([]);
  const [unbudgeted, setUnbudgeted] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [amountValue, setAmountValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentAccountId || !currentUser) return;
    try {
      const [account, result] = await Promise.all([
        new AccountRepository().findById(currentAccountId),
        new BudgetService(currentAccountId, currentUser.id).loadMonth(month),
      ]);
      setCurrency(account?.currency ?? 'USD');
      setProgress(result.progress);
      setUnbudgeted(result.unbudgeted);
    } catch (error) {
      console.error('[BudgetScreen] Failed to load budgets:', error);
      Alert.alert('Error', 'Failed to load budgets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentAccountId, currentUser, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const totals = useMemo(() => {
    const budgeted = progress.reduce((sum, p) => sum + p.amountLimit, 0);
    const spent = progress.reduce((sum, p) => sum + p.spent, 0);
    return { budgeted, spent, remaining: budgeted - spent };
  }, [progress]);

  const openAddModal = () => {
    if (unbudgeted.length === 0) {
      Alert.alert('All Set', 'Every expense category already has a budget for this month.');
      return;
    }
    setEditingCategory(null);
    setAmountValue('');
    setModalVisible(true);
  };

  const openEditModal = (item: BudgetProgress) => {
    const category: Category = {
      id: item.categoryId,
      userId: currentUser?.id ?? '',
      name: item.categoryName,
      type: 'expense',
      icon: item.categoryIcon,
      color: item.categoryColor,
      isDefault: false,
      createdAt: 0,
    };
    setEditingCategory(category);
    setAmountValue(item.amountLimit.toString());
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!currentAccountId || !editingCategory) return;
    const amount = parseFloat(amountValue);
    if (!amount || amount <= 0) {
      Alert.alert('Validation Error', 'Enter a budget amount greater than 0');
      return;
    }
    setSaving(true);
    try {
      await new BudgetService(currentAccountId, currentUser!.id).setBudget(editingCategory.id, month, amount);
      setModalVisible(false);
      load();
    } catch (error) {
      console.error('[BudgetScreen] Failed to save budget:', error);
      Alert.alert('Error', 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    if (!currentAccountId || !editingCategory) return;
    Alert.alert('Remove Budget', `Remove the budget for "${editingCategory.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await new BudgetService(currentAccountId, currentUser!.id).removeBudget(editingCategory.id, month);
            setModalVisible(false);
            load();
          } catch (error) {
            console.error('[BudgetScreen] Failed to remove budget:', error);
            Alert.alert('Error', 'Failed to remove budget');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: BudgetProgress }) => {
    const statusColor = getBudgetStatusColor(item.percentage);
    const barWidth = Math.min(item.percentage, 100);
    return (
      <TouchableOpacity style={styles.row} onPress={() => openEditModal(item)} activeOpacity={0.7}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconCircle, { backgroundColor: item.categoryColor }]}>
              <MaterialCommunityIcons name={item.categoryIcon as any} size={18} color={themeColors.neutral.white} />
            </View>
            <Text style={styles.categoryName}>{item.categoryName}</Text>
          </View>
          <Text style={[styles.percentageText, { color: statusColor }]}>{item.percentage.toFixed(0)}%</Text>
        </View>

        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${barWidth}%`, backgroundColor: statusColor }]} />
        </View>

        <View style={styles.rowFooter}>
          <Text style={styles.spentText}>
            {formatCurrency(item.spent, currency)} of {formatCurrency(item.amountLimit, currency)}
          </Text>
          <Text style={[styles.remainingText, { color: item.remaining < 0 ? themeColors.error : themeColors.textSecondary }]}>
            {item.remaining < 0
              ? `${formatCurrency(Math.abs(item.remaining), currency)} over`
              : `${formatCurrency(item.remaining, currency)} left`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Month selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => setMonth((m) => shiftMonthKey(m, -1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
        <TouchableOpacity onPress={() => setMonth((m) => shiftMonthKey(m, 1))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="chevron-right" size={26} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Budgeted</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totals.budgeted, currency)}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Spent</Text>
          <Text style={[styles.summaryValue, { color: themeColors.error }]}>{formatCurrency(totals.spent, currency)}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Remaining</Text>
          <Text style={[styles.summaryValue, { color: totals.remaining < 0 ? themeColors.error : themeColors.success }]}>
            {formatCurrency(totals.remaining, currency)}
          </Text>
        </View>
      </View>

      {/* Budget list */}
      <FlatList
        data={progress}
        keyExtractor={(item) => item.categoryId}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chart-donut" size={64} color={themeColors.textSecondary} />
              <Text style={styles.emptyTitle}>No Budgets Yet</Text>
              <Text style={styles.emptySubtitle}>Set a monthly spending cap per category to track it here</Text>
            </View>
          ) : null
        }
      />

      {/* Add Budget Button */}
      <View style={styles.footer}>
        <Button
          title="Add Budget"
          onPress={openAddModal}
          leftIcon={<MaterialCommunityIcons name="plus" size={20} color="#FFF" />}
        />
      </View>

      {/* Set/Edit Budget Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCategory ? 'Edit Budget' : 'Add Budget'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {!editingCategory ? (
              <CategoryPicker
                categories={unbudgeted}
                selectedCategory={editingCategory ?? undefined}
                onSelectCategory={setEditingCategory}
                type="expense"
                label="Category"
              />
            ) : (
              <View style={styles.modalCategoryPreview}>
                <View style={[styles.iconCircle, { backgroundColor: editingCategory.color }]}>
                  <MaterialCommunityIcons name={editingCategory.icon as any} size={18} color={themeColors.neutral.white} />
                </View>
                <Text style={styles.categoryName}>{editingCategory.name}</Text>
              </View>
            )}

            <AmountInput
              label={`Monthly Limit (${currency})`}
              value={amountValue}
              onChangeText={setAmountValue}
              currency={getCurrencySymbol(currency)}
            />

            <View style={styles.modalActions}>
              <Button
                title={editingCategory ? 'Save' : 'Set Budget'}
                onPress={handleSave}
                loading={saving}
                disabled={!editingCategory}
                style={{ flex: 1 }}
              />
            </View>
            {editingCategory && (
              <TouchableOpacity onPress={handleRemove} style={styles.removeButton}>
                <Text style={styles.removeButtonText}>Remove Budget</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: themeColors.surface,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    monthLabel: {
      ...typography.h3,
      color: themeColors.text,
      minWidth: 160,
      textAlign: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      padding: spacing.md,
      gap: spacing.sm,
    },
    summaryTile: {
      flex: 1,
      backgroundColor: themeColors.glass.background,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: themeColors.glass.borderLight,
      padding: spacing.md,
      gap: spacing.xs,
    },
    summaryLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    summaryValue: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
    },
    listContent: {
      padding: spacing.md,
      paddingTop: 0,
      flexGrow: 1,
    },
    row: {
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: themeColors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    rowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryName: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.text,
    },
    percentageText: {
      ...typography.body,
      fontWeight: '700',
    },
    progressBarBackground: {
      height: 8,
      borderRadius: 4,
      backgroundColor: themeColors.border,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    rowFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    spentText: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    remainingText: {
      ...typography.caption,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxxl,
      gap: spacing.sm,
    },
    emptyTitle: {
      ...typography.h3,
      color: themeColors.text,
    },
    emptySubtitle: {
      ...typography.body,
      color: themeColors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    footer: {
      padding: spacing.md,
      backgroundColor: themeColors.surface,
      borderTopWidth: 1,
      borderTopColor: themeColors.border,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: borderRadius.xxl,
      borderTopRightRadius: borderRadius.xxl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    modalTitle: {
      ...typography.h3,
      color: themeColors.text,
    },
    modalCategoryPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    modalActions: {
      flexDirection: 'row',
      marginTop: spacing.sm,
    },
    removeButton: {
      alignItems: 'center',
      marginTop: spacing.md,
    },
    removeButtonText: {
      ...typography.body,
      color: themeColors.error,
      fontWeight: '600',
    },
  });
