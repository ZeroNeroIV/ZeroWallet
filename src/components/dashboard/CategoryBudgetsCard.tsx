import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { BudgetRepository } from '../../database/repositories/BudgetRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import type { BudgetStatus, Category } from '../../types/models';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic, mediumHaptic, heavyHaptic } from '../../services/haptics/hapticFeedback';

interface CategoryBudgetsCardProps {
  accountId: string;
  currency: string;
  onBudgetChange?: () => void;
}

export const CategoryBudgetsCard: React.FC<CategoryBudgetsCardProps> = ({
  accountId,
  currency,
  onBudgetChange,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetStatus | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [rollover, setRollover] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!accountId) return;
    try {
      const budgetRepo = new BudgetRepository();
      const catRepo = new CategoryRepository();

      const [statusList, catList] = await Promise.all([
        budgetRepo.getBudgetStatuses(accountId),
        catRepo.findAll(),
      ]);

      setStatuses(statusList);
      setCategories(catList.filter((c) => c.type === 'expense'));
    } catch (err) {
      console.warn('[CategoryBudgetsCard] Failed to load budgets:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    lightHaptic();
    setEditingBudget(null);
    setSelectedCategoryId(categories[0]?.id || '');
    setAmountStr('');
    setRollover(false);
    setModalVisible(true);
  };

  const openEdit = (status: BudgetStatus) => {
    lightHaptic();
    setEditingBudget(status);
    setSelectedCategoryId(status.budget.categoryId);
    setAmountStr(status.budget.amount.toString());
    setRollover(status.budget.rollover);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid monthly budget limit.');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('Category Required', 'Please select a category for this budget.');
      return;
    }

    setSaving(true);
    try {
      const budgetRepo = new BudgetRepository();
      if (editingBudget) {
        await budgetRepo.update(editingBudget.budget.id, {
          categoryId: selectedCategoryId,
          amount,
          rollover,
          period: 'monthly',
        });
      } else {
        await budgetRepo.create({
          accountId,
          categoryId: selectedCategoryId,
          amount,
          rollover,
          period: 'monthly',
        });
      }

      mediumHaptic();
      setModalVisible(false);
      await loadData();
      if (onBudgetChange) onBudgetChange();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingBudget) return;
    heavyHaptic();
    Alert.alert('Delete Budget', 'Are you sure you want to remove this category budget?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await new BudgetRepository().delete(editingBudget.budget.id);
            mediumHaptic();
            setModalVisible(false);
            await loadData();
            if (onBudgetChange) onBudgetChange();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete budget.');
          }
        },
      },
    ]);
  };

  const warningCount = statuses.filter((s) => s.isWarning).length;
  const exceededCount = statuses.filter((s) => s.isExceeded).length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Category Budgets</Text>
          {statuses.length > 0 && (
            <Text style={styles.subtitle}>
              {exceededCount > 0
                ? `${exceededCount} exceeded`
                : warningCount > 0
                ? `${warningCount} near limit`
                : `${statuses.length} on track`}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.addSmallBtn} onPress={openAdd} hitSlop={8}>
          <MaterialCommunityIcons name="plus" size={18} color={themeColors.primary} />
          <Text style={styles.addSmallBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={themeColors.primary} style={styles.loader} />
      ) : statuses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: themeColors.primary + '15' }]}>
            <MaterialCommunityIcons name="bullseye-arrow" size={28} color={themeColors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Budgets Set</Text>
          <Text style={styles.emptySubtitle}>
            Set monthly spending caps for your categories to maintain healthy cash flow.
          </Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
            <MaterialCommunityIcons name="plus" size={18} color="#FFF" />
            <Text style={styles.emptyAddBtnText}>Set First Budget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.budgetList}>
          {statuses.map((item) => {
            const cat = item.category;
            const progress = Math.min(item.percentage, 100);
            const progressColor = item.isExceeded
              ? themeColors.error
              : item.isWarning
              ? themeColors.warning
              : themeColors.primary;

            return (
              <TouchableOpacity
                key={item.budget.id}
                style={styles.budgetItem}
                onPress={() => openEdit(item)}
                activeOpacity={0.7}
              >
                <View style={styles.budgetTopRow}>
                  <View style={styles.categoryInfo}>
                    <View
                      style={[
                        styles.catIconCircle,
                        { backgroundColor: (cat?.color || themeColors.primary) + '25' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={(cat?.icon as any) || 'tag-outline'}
                        size={18}
                        color={cat?.color || themeColors.primary}
                      />
                    </View>
                    <View>
                      <Text style={styles.catName}>{cat?.name || 'Category'}</Text>
                      {item.budget.rollover && (
                        <Text style={styles.rolloverTag}>Rollover Active</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.amountInfo}>
                    <Text style={styles.amountText}>
                      <Text style={styles.spentBold}>{item.spent.toFixed(2)}</Text> / {item.budget.amount.toFixed(2)} {currency}
                    </Text>
                    <Text style={[styles.statusTag, { color: progressColor }]}>
                      {item.isExceeded
                        ? `Exceeded +${(item.spent - item.budget.amount).toFixed(2)}`
                        : `${item.remaining.toFixed(2)} left (${Math.round(item.percentage)}%)`}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${progress}%`,
                        backgroundColor: progressColor,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Set / Edit Budget Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingBudget ? 'Edit Budget' : 'Set Category Budget'}
              </Text>
              {!saving && (
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={24} color={themeColors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catPickerScroll}>
              {categories.map((c) => {
                const selected = selectedCategoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.catChip,
                      selected && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '15' },
                    ]}
                    onPress={() => {
                      lightHaptic();
                      setSelectedCategoryId(c.id);
                    }}
                  >
                    <MaterialCommunityIcons
                      name={c.icon as any}
                      size={16}
                      color={selected ? themeColors.primary : themeColors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.catChipText,
                        selected && { color: themeColors.primary, fontWeight: '700' },
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>Monthly Spending Limit ({currency})</Text>
            <TextInput
              style={styles.input}
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="e.g. 150"
              placeholderTextColor={themeColors.textSecondary}
              keyboardType="decimal-pad"
            />

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Rollover Remaining Budget</Text>
                <Text style={styles.switchDesc}>
                  Unspent amounts carry forward into the next month's allowance
                </Text>
              </View>
              <Switch
                value={rollover}
                onValueChange={(val) => {
                  lightHaptic();
                  setRollover(val);
                }}
                trackColor={{
                  false: themeColors.border,
                  true: themeColors.primary,
                }}
                thumbColor="#FFF"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editingBudget ? 'Save Changes' : 'Create Budget'}
                </Text>
              )}
            </TouchableOpacity>

            {editingBudget && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                disabled={saving}
              >
                <MaterialCommunityIcons name="delete-outline" size={18} color={themeColors.error} />
                <Text style={styles.deleteBtnText}>Remove Budget</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    headerTitleContainer: {
      gap: 2,
    },
    title: {
      ...typography.bodyLarge,
      fontWeight: '700',
      color: themeColors.text,
    },
    subtitle: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    addSmallBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
      backgroundColor: themeColors.primary + '15',
    },
    addSmallBtnText: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.primary,
    },
    loader: {
      marginVertical: spacing.lg,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    emptyIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 4,
    },
    emptySubtitle: {
      ...typography.caption,
      color: themeColors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.md,
      lineHeight: 18,
    },
    emptyAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: themeColors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    emptyAddBtnText: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFF',
    },
    budgetList: {
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    budgetItem: {
      backgroundColor: themeColors.background,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    budgetTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    categoryInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    catIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catName: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
    },
    rolloverTag: {
      ...typography.caption,
      fontSize: 10,
      color: themeColors.textSecondary,
    },
    amountInfo: {
      alignItems: 'flex-end',
      gap: 2,
    },
    amountText: {
      ...typography.body,
      color: themeColors.text,
    },
    spentBold: {
      fontWeight: '700',
    },
    statusTag: {
      ...typography.caption,
      fontWeight: '700',
      fontSize: 11,
    },
    progressBarTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: themeColors.border,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      maxHeight: '90%',
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    sheetTitle: {
      ...typography.h3,
      color: themeColors.text,
    },
    fieldLabel: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.text,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    catPickerScroll: {
      marginBottom: spacing.sm,
    },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginRight: spacing.sm,
      backgroundColor: themeColors.background,
    },
    catChipText: {
      ...typography.caption,
      fontWeight: '600',
      color: themeColors.text,
    },
    input: {
      ...typography.body,
      color: themeColors.text,
      backgroundColor: themeColors.background,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginBottom: spacing.md,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: spacing.sm,
      paddingVertical: spacing.xs,
    },
    switchInfo: {
      flex: 1,
      paddingRight: spacing.md,
    },
    switchTitle: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.text,
    },
    switchDesc: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    saveBtn: {
      backgroundColor: themeColors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    saveBtnText: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFF',
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    deleteBtnText: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.error,
    },
    btnDisabled: {
      opacity: 0.6,
    },
  });
