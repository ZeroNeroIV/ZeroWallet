/**
 * Purpose: Create or edit recurring expenses with frequency picker and auto-deduct option
 * 
 * Inputs:
 *   - route.params.mode ('edit'): Edit mode flag
 *   - route.params.recurringId (string): Recurring expense ID when editing
 * 
 * Outputs:
 *   - Returns (JSX.Element): Recurring expense creation/edit form
 * 
 * Side effects:
 *   - Creates new recurring expense in database
 *   - Updates existing recurring expense in database
 *   - Navigates back on success
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Input } from '../../components/forms/Input';
import { Button } from '../../components/forms/Button';
import { AmountInput } from '../../components/forms/AmountInput';
import { CategoryPicker } from '../../components/forms/CategoryPicker';
import { useAuthStore } from '../../store/authStore';
import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { validateRequired } from '../../utils/validators';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { Category, VaultType, RecurringFrequency } from '../../types/models';
import { useThemeColors } from '../../hooks/useThemeColors';

type AddRecurringNavigationProp = StackNavigationProp<
  MainStackParamList,
  'AddRecurring'
>;

type AddRecurringRouteProp = RouteProp<MainStackParamList, 'AddRecurring'>;

const VAULT_OPTIONS: { value: VaultType; label: string; icon: string }[] = [
  { value: 'main', label: 'Main Wallet', icon: 'wallet' },
  { value: 'savings', label: 'Savings', icon: 'piggy-bank' },
  { value: 'held', label: 'Held Funds', icon: 'lock' },
];

const FREQUENCY_OPTIONS: {
  value: RecurringFrequency;
  label: string;
  icon: string;
}[] = [
    { value: 'daily', label: 'Daily', icon: 'calendar-today' },
    { value: 'weekly', label: 'Weekly', icon: 'calendar-week' },
    { value: 'monthly', label: 'Monthly', icon: 'calendar-month' },
    { value: 'yearly', label: 'Yearly', icon: 'calendar' },
  ];

export default function AddRecurringExpenseScreen() {
  const navigation = useNavigation<AddRecurringNavigationProp>();
  const route = useRoute<AddRecurringRouteProp>();
  const currentAccountId = useAuthStore((state) => state.currentAccountId);
  const currentUser = useAuthStore((state) => state.currentUser);
  const themeColors = useThemeColors();

  const isEditMode = route.params?.mode === 'edit';
  const recurringId = route.params?.recurringId;

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [interval, setInterval] = useState(1);
  const [selectedVault, setSelectedVault] = useState<VaultType>('main');
  const [isActive, setIsActive] = useState(true);
  const [autoDeduct, setAutoDeduct] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Load expense categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      if (!currentUser) return;

      try {
        const categoryRepo = new CategoryRepository();
        const expenseCategories = await categoryRepo.findByUserAndType(currentUser.id, 'expense');
        setCategories(expenseCategories);
      } catch (error) {
        console.error('[AddRecurring] Failed to load categories:', error);
      }
    };

    loadCategories();
  }, [currentUser]);

  useEffect(() => {
    if (isEditMode && recurringId) {
      loadRecurringExpense();
    }
  }, []);

  const loadRecurringExpense = async () => {
    if (!recurringId) return;

    try {
      const recurringRepo = new RecurringExpenseRepository();
      const categoryRepo = new CategoryRepository();

      const expense = await recurringRepo.findById(recurringId);

      if (expense) {
        setName(expense.name);
        setAmount(expense.amount.toString());
        setFrequency(expense.frequency);
        setInterval(expense.interval);
        setSelectedVault(expense.vaultType);
        setIsActive(expense.isActive);
        setAutoDeduct(expense.autoDeduct);

        const category = await categoryRepo.findById(expense.categoryId);
        setSelectedCategory(category);
      } else {
        Alert.alert('Error', 'Recurring expense not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('[AddRecurring] Failed to load expense:', error);
      Alert.alert('Error', 'Failed to load recurring expense');
      navigation.goBack();
    }
  };

  const calculateNextOccurrence = (
    freq: RecurringFrequency,
    int: number
  ): number => {
    const nextDate = new Date();

    switch (freq) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + int);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + int * 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + int);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + int);
        break;
    }

    return nextDate.getTime();
  };

  const handleSave = async () => {
    if (!currentAccountId) {
      Alert.alert('Error', 'Account not found');
      return;
    }

    // Validate
    const nameError = validateRequired(name, 'Expense name');
    const amountError = validateRequired(amount, 'Amount');

    if (nameError || amountError) {
      setErrors({
        name: nameError || undefined,
        amount: amountError || undefined,
      });
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrors({ amount: 'Please enter a valid amount' });
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const recurringRepo = new RecurringExpenseRepository();
      const nextOccurrence = calculateNextOccurrence(frequency, interval);

      if (isEditMode && recurringId) {
        // Update existing
        await recurringRepo.update(recurringId, {
          name: name.trim(),
          amount: amountNum,
          categoryId: selectedCategory.id,
          frequency,
          interval,
          nextOccurrence,
          vaultType: selectedVault,
          isActive,
          autoDeduct,
        });

        Alert.alert('Success', 'Recurring expense updated', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // Create new
        await recurringRepo.create({
          accountId: currentAccountId,
          name: name.trim(),
          amount: amountNum,
          categoryId: selectedCategory.id,
          frequency,
          interval,
          nextOccurrence,
          vaultType: selectedVault,
          isActive,
          autoDeduct,
        });

        Alert.alert('Success', 'Recurring expense created', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      console.error('[AddRecurring] Failed to save:', error);
      Alert.alert('Error', 'Failed to save recurring expense');
    } finally {
      setLoading(false);
    }
  };

  const getFrequencyText = (): string => {
    const freqLabel = FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.label;
    if (interval === 1) {
      return freqLabel || frequency;
    }
    return `Every ${interval} ${frequency === 'daily' ? 'days' : frequency === 'weekly' ? 'weeks' : frequency === 'monthly' ? 'months' : 'years'}`;
  };

  const intervals = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Name */}
      <Input
        label="Expense Name"
        placeholder="e.g., Rent, Insurance, Maintenance"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setErrors({});
        }}
        error={errors.name}
        leftIcon="clock-outline"
        autoFocus={!isEditMode}
      />

      {/* Amount */}
      <AmountInput
        label="Amount"
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setErrors({});
        }}
        error={errors.amount}
      />

      {/* Category */}
      <View style={styles.section}>
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowCategoryPicker(true)}
        >
          {selectedCategory ? (
            <View style={styles.pickerContent}>
              <View
                style={[
                  styles.categoryIcon,
                  { backgroundColor: selectedCategory.color },
                ]}
              >
                <Icon
                  name={selectedCategory.icon}
                  size={20}
                  color={themeColors.surface}
                />
              </View>
              <Text style={styles.pickerText}>{selectedCategory.name}</Text>
            </View>
          ) : (
            <Text style={styles.pickerPlaceholder}>Select category</Text>
          )}
          <Icon name="chevron-down" size={24} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Frequency */}
      <View style={styles.section}>
        <Text style={styles.label}>Frequency</Text>
        <View style={styles.frequencyGrid}>
          {FREQUENCY_OPTIONS.map((freq) => (
            <TouchableOpacity
              key={freq.value}
              style={[
                styles.frequencyOption,
                frequency === freq.value && styles.frequencyOptionSelected,
              ]}
              onPress={() => setFrequency(freq.value)}
            >
              <Icon
                name={freq.icon}
                size={20}
                color={
                  frequency === freq.value
                    ? themeColors.primary
                    : themeColors.textSecondary
                }
              />
              <Text
                style={[
                  styles.frequencyText,
                  frequency === freq.value && styles.frequencyTextSelected,
                ]}
              >
                {freq.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Interval */}
      <View style={styles.section}>
        <Text style={styles.label}>Interval</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowIntervalPicker(!showIntervalPicker)}
        >
          <Text style={styles.pickerText}>{getFrequencyText()}</Text>
          <Icon name="chevron-down" size={24} color={themeColors.textSecondary} />
        </TouchableOpacity>

        {showIntervalPicker && (
          <View style={styles.intervalGrid}>
            {intervals.map((int) => (
              <TouchableOpacity
                key={int}
                style={[
                  styles.intervalButton,
                  interval === int && styles.intervalButtonSelected,
                ]}
                onPress={() => {
                  setInterval(int);
                  setShowIntervalPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.intervalText,
                    interval === int && styles.intervalTextSelected,
                  ]}
                >
                  {int}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Vault Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Deduct From</Text>
        <View style={styles.vaultGrid}>
          {VAULT_OPTIONS.map((vault) => (
            <TouchableOpacity
              key={vault.value}
              style={[
                styles.vaultOption,
                selectedVault === vault.value && styles.vaultOptionSelected,
              ]}
              onPress={() => setSelectedVault(vault.value)}
            >
              <Icon
                name={vault.icon}
                size={24}
                color={
                  selectedVault === vault.value
                    ? themeColors.primary
                    : themeColors.textSecondary
                }
              />
              <Text
                style={[
                  styles.vaultText,
                  selectedVault === vault.value && styles.vaultTextSelected,
                ]}
              >
                {vault.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Auto-Deduct Toggle */}
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setAutoDeduct(!autoDeduct)}
      >
        <View style={styles.toggleLeft}>
          <Icon
            name={autoDeduct ? 'lightning-bolt' : 'hand-coin-outline'}
            size={24}
            color={autoDeduct ? themeColors.warning : themeColors.textSecondary}
          />
          <View>
            <Text style={styles.toggleTitle}>
              {autoDeduct ? 'Auto-Deduct' : 'Manual'}
            </Text>
            <Text style={styles.toggleSubtitle}>
              {autoDeduct
                ? 'Automatically deduct when due'
                : 'Manually trigger when needed'}
            </Text>
          </View>
        </View>
        <Icon
          name={autoDeduct ? 'toggle-switch' : 'toggle-switch-off'}
          size={32}
          color={autoDeduct ? themeColors.primary : themeColors.textSecondary}
        />
      </TouchableOpacity>

      {/* Active Toggle */}
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setIsActive(!isActive)}
      >
        <View style={styles.toggleLeft}>
          <Icon
            name={isActive ? 'check-circle' : 'close-circle'}
            size={24}
            color={isActive ? themeColors.success : themeColors.textSecondary}
          />
          <View>
            <Text style={styles.toggleTitle}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.toggleSubtitle}>
              {isActive ? 'Expense is active' : 'Paused, will not process'}
            </Text>
          </View>
        </View>
        <Icon
          name={isActive ? 'toggle-switch' : 'toggle-switch-off'}
          size={32}
          color={isActive ? themeColors.primary : themeColors.textSecondary}
        />
      </TouchableOpacity>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title={isEditMode ? 'Update Expense' : 'Create Expense'}
          onPress={handleSave}
          loading={loading}
          leftIcon={<Icon name={isEditMode ? 'check' : 'plus'} size={20} color="#FFF" />}
        />
      </View>

      {/* Category Picker Modal */}
      {showCategoryPicker && (
        <Modal visible={showCategoryPicker} animationType="slide">
          <View style={{ flex: 1, backgroundColor: themeColors.background }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Icon name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <CategoryPicker
              categories={categories}
              onSelectCategory={(category: Category) => {
                setSelectedCategory(category);
                setShowCategoryPicker(false);
              }}
              type="expense"
            />
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: spacing.sm,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerText: {
    ...typography.body,
    color: themeColors.text,
  },
  pickerPlaceholder: {
    ...typography.body,
    color: themeColors.textSecondary,
  },
  frequencyGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  frequencyOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: themeColors.border,
    gap: spacing.xs,
  },
  frequencyOptionSelected: {
    borderColor: themeColors.primary,
    backgroundColor: themeColors.primaryLight + '10',
  },
  frequencyText: {
    ...typography.caption,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  frequencyTextSelected: {
    color: themeColors.primary,
  },
  intervalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderRadius: borderRadius.md,
    ...{
      shadowColor: themeColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  intervalButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: themeColors.border,
  },
  intervalButtonSelected: {
    backgroundColor: themeColors.primary,
  },
  intervalText: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  intervalTextSelected: {
    color: themeColors.surface,
  },
  vaultGrid: {
    gap: spacing.sm,
  },
  vaultOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: themeColors.border,
    gap: spacing.md,
  },
  vaultOptionSelected: {
    borderColor: themeColors.primary,
    backgroundColor: themeColors.primaryLight + '10',
  },
  vaultText: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  vaultTextSelected: {
    color: themeColors.primary,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...{
      shadowColor: themeColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  toggleTitle: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  toggleSubtitle: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: themeColors.text,
  },
});
