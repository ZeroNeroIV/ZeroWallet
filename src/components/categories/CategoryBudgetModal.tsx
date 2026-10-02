/**
 * Purpose: Fast inline Simplizum Modal for creating or editing a Category and its Budget limit.
 * 
 * Features:
 * - Category Name, Type toggle, curated Vector Icon picker, and color swatches
 * - Integrated Monthly Spending Limit with Rollover toggle
 * - Clean 1px border aesthetic with tabular numbers and responsive haptic feedback
 */

import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { getCurrencySymbol } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import type { Category, CategoryType, Budget } from '../../types/models';
import type { CategoryWithBudget } from '../../services/categoryBudgetService';

interface CategoryBudgetModalProps {
  visible: boolean;
  item: CategoryWithBudget | null; // null if creating new
  initialType?: CategoryType;
  currency: string;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    name: string;
    type: CategoryType;
    icon: string;
    color: string;
    budgetAmount?: number | null;
    rollover?: boolean;
  }) => Promise<void>;
  onDeleteCategory?: (categoryId: string) => Promise<void>;
}

const EXPENSE_ICONS = [
  'food',
  'silverware-fork-knife',
  'coffee',
  'cart',
  'shopping',
  'car',
  'bus',
  'airplane',
  'gas-station',
  'movie',
  'music',
  'gamepad-variant',
  'receipt',
  'file-document',
  'home',
  'lightning-bolt',
  'water',
  'medical-bag',
  'pill',
  'dumbbell',
  'tshirt-crew',
  'shoe-sneaker',
  'phone',
  'laptop',
  'television',
  'gift',
  'school',
  'book-open',
  'paw',
  'hammer',
  'wrench',
  'dots-horizontal',
];

const INCOME_ICONS = [
  'briefcase',
  'account-tie',
  'laptop',
  'code-tags',
  'cash',
  'cash-multiple',
  'currency-usd',
  'bank',
  'chart-line',
  'trending-up',
  'finance',
  'gift',
  'hand-coin',
  'piggy-bank',
  'wallet',
  'sale',
  'office-building',
  'desktop-mac',
];

const ARCHITECTURAL_COLORS = [
  '#EF4444', // Crimson
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Cobalt
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Rose
  '#64748B', // Slate
  '#78716C', // Stone
  '#0EA5E9', // Sky
];

export const CategoryBudgetModal = memo(function CategoryBudgetModal({
  visible,
  item,
  initialType = 'expense',
  currency,
  onClose,
  onSave,
  onDeleteCategory,
}: CategoryBudgetModalProps) {
  const themeColors = useThemeColors();
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>(initialType);
  const [selectedIcon, setSelectedIcon] = useState('tag-outline');
  const [selectedColor, setSelectedColor] = useState(ARCHITECTURAL_COLORS[0]);

  // Budget state
  const [hasBudget, setHasBudget] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [rollover, setRollover] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(item);
  const isDefaultCategory = Boolean(item?.category?.isDefault);

  useEffect(() => {
    if (visible) {
      if (item) {
        setName(item.category.name);
        setType(item.category.type);
        setSelectedIcon(item.category.icon || 'tag-outline');
        setSelectedColor(item.category.color || ARCHITECTURAL_COLORS[0]);

        if (item.budget && item.budget.amount > 0) {
          setHasBudget(true);
          setBudgetAmount(item.budget.amount.toString());
          setRollover(Boolean(item.budget.rollover));
        } else {
          setHasBudget(false);
          setBudgetAmount('');
          setRollover(false);
        }
      } else {
        setName('');
        setType(initialType);
        setSelectedIcon(initialType === 'expense' ? EXPENSE_ICONS[0] : INCOME_ICONS[0]);
        setSelectedColor(ARCHITECTURAL_COLORS[3]);
        setHasBudget(false);
        setBudgetAmount('');
        setRollover(false);
      }
    }
  }, [visible, item, initialType]);

  const availableIcons = type === 'expense' ? EXPENSE_ICONS : INCOME_ICONS;

  const handleTypeChange = (newType: CategoryType) => {
    triggerHaptic('selection');
    setType(newType);
    if (!availableIcons.includes(selectedIcon)) {
      setSelectedIcon(newType === 'expense' ? EXPENSE_ICONS[0] : INCOME_ICONS[0]);
    }
  };

  const handleSelectIcon = (iconName: string) => {
    triggerHaptic('selection');
    setSelectedIcon(iconName);
  };

  const handleSelectColor = (hex: string) => {
    triggerHaptic('selection');
    setSelectedColor(hex);
  };

  const handleQuickAddBudget = (delta: number) => {
    triggerHaptic('impactLight');
    const current = parseFloat(budgetAmount) || 0;
    setBudgetAmount((current + delta).toString());
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a category name');
      return;
    }

    let parsedBudget: number | null | undefined = undefined;
    if (type === 'expense') {
      if (hasBudget) {
        const num = parseFloat(budgetAmount);
        if (isNaN(num) || num <= 0) {
          Alert.alert('Invalid Budget', 'Please enter a valid monthly budget limit greater than 0');
          return;
        }
        parsedBudget = num;
      } else if (item?.budget) {
        // User turned off budget that previously existed
        parsedBudget = null;
      }
    }

    try {
      setIsSubmitting(true);
      triggerHaptic('notificationSuccess');
      await onSave({
        id: item?.category?.id,
        name: name.trim(),
        type,
        icon: selectedIcon,
        color: selectedColor,
        budgetAmount: parsedBudget,
        rollover,
      });
      onClose();
    } catch (error: any) {
      console.error('[CategoryBudgetModal] Save failed:', error);
      Alert.alert('Save Error', error?.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!item?.category?.id || isDefaultCategory || !onDeleteCategory) return;

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${item.category.name}"? Transactions assigned to this category will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('notificationWarning');
              await onDeleteCategory(item.category.id);
              onClose();
            } catch (err: any) {
              Alert.alert('Delete Error', err?.message || 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
        >
          {/* Header Bar */}
          <View style={[styles.headerBar, { borderBottomColor: themeColors.borderSubtle }]}>
            <View>
              <Text style={[styles.headerSubtitle, { color: themeColors.textMuted }]}>
                {isEditing ? 'CATEGORY CONFIGURATION' : 'NEW CLASSIFICATION'}
              </Text>
              <Text style={[styles.headerTitle, { color: themeColors.text }]}>
                {isEditing ? item?.category?.name : 'Create Category'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { borderColor: themeColors.borderSubtle }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={18} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Category Type Selector (when creating new) */}
            {!isEditing && (
              <View style={styles.sectionBlock}>
                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                  TRANSACTION TYPE
                </Text>
                <View
                  style={[
                    styles.segmentContainer,
                    {
                      borderColor: themeColors.border,
                      backgroundColor: themeColors.surfaceElevated,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      type === 'expense' && [
                        styles.segmentButtonActive,
                        {
                          backgroundColor: themeColors.surface,
                          borderColor: themeColors.border,
                        },
                      ],
                    ]}
                    onPress={() => handleTypeChange('expense')}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color:
                            type === 'expense' ? themeColors.text : themeColors.textMuted,
                          fontWeight:
                            type === 'expense'
                              ? typography.weights.bold
                              : typography.weights.medium,
                        },
                      ]}
                    >
                      EXPENSE
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      type === 'income' && [
                        styles.segmentButtonActive,
                        {
                          backgroundColor: themeColors.surface,
                          borderColor: themeColors.border,
                        },
                      ],
                    ]}
                    onPress={() => handleTypeChange('income')}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color:
                            type === 'income' ? themeColors.text : themeColors.textMuted,
                          fontWeight:
                            type === 'income'
                              ? typography.weights.bold
                              : typography.weights.medium,
                        },
                      ]}
                    >
                      INCOME
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Category Name */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                CATEGORY NAME
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: themeColors.text,
                    backgroundColor: themeColors.surfaceElevated,
                    borderColor: themeColors.border,
                  },
                ]}
                placeholder="e.g. Groceries, Coffee, Salary..."
                placeholderTextColor={themeColors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Icon Picker */}
            <View style={styles.sectionBlock}>
              <View style={styles.labelWithPreview}>
                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                  SELECT ICON
                </Text>
                <View
                  style={[
                    styles.previewPill,
                    {
                      borderColor: themeColors.borderSubtle,
                      backgroundColor: `${selectedColor}15`,
                    },
                  ]}
                >
                  <Icon name={selectedIcon} size={14} color={selectedColor} />
                  <Text style={[styles.previewPillText, { color: selectedColor }]}>
                    {selectedIcon}
                  </Text>
                </View>
              </View>

              <View style={styles.iconGrid}>
                {availableIcons.map((ic) => {
                  const isSelected = ic === selectedIcon;
                  return (
                    <TouchableOpacity
                      key={ic}
                      style={[
                        styles.iconGridItem,
                        {
                          borderColor: isSelected ? themeColors.text : themeColors.borderSubtle,
                          backgroundColor: isSelected
                            ? themeColors.surfaceElevated
                            : 'transparent',
                        },
                      ]}
                      onPress={() => handleSelectIcon(ic)}
                    >
                      <Icon
                        name={ic}
                        size={18}
                        color={isSelected ? selectedColor : themeColors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Color Swatches */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                ARCHITECTURAL PALETTE
              </Text>
              <View style={styles.colorRow}>
                {ARCHITECTURAL_COLORS.map((c) => {
                  const isSelected = c === selectedColor;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorSwatch,
                        {
                          backgroundColor: c,
                          borderColor: isSelected ? themeColors.text : 'transparent',
                        },
                      ]}
                      onPress={() => handleSelectColor(c)}
                    >
                      {isSelected && (
                        <Icon name="check" size={12} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Monthly Budget Limit (Expenses Only) */}
            {type === 'expense' && (
              <View
                style={[
                  styles.budgetCard,
                  {
                    backgroundColor: themeColors.surfaceElevated,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <View style={styles.budgetCardHeader}>
                  <View style={styles.budgetHeaderLeft}>
                    <Icon
                      name="chart-arc"
                      size={18}
                      color={hasBudget ? themeColors.accent : themeColors.textMuted}
                    />
                    <View style={styles.budgetTitleBlock}>
                      <Text style={[styles.budgetHeading, { color: themeColors.text }]}>
                        MONTHLY SPENDING LIMIT
                      </Text>
                      <Text style={[styles.budgetSubheading, { color: themeColors.textMuted }]}>
                        Hairline tracking for spending thresholds
                      </Text>
                    </View>
                  </View>

                  <Switch
                    value={hasBudget}
                    onValueChange={(val) => {
                      triggerHaptic('selection');
                      setHasBudget(val);
                      if (val && !budgetAmount) {
                        setBudgetAmount('500');
                      }
                    }}
                    trackColor={{
                      false: themeColors.border,
                      true: themeColors.accent,
                    }}
                    thumbColor={themeColors.surface}
                  />
                </View>

                {hasBudget && (
                  <View style={styles.budgetInputsBlock}>
                    <Text style={[styles.microLabel, { color: themeColors.textSecondary }]}>
                      BUDGET CEILING ({currency})
                    </Text>
                    <View
                      style={[
                        styles.amountInputRow,
                        {
                          backgroundColor: themeColors.surface,
                          borderColor: themeColors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.currencyPrefix, { color: themeColors.textMuted }]}>
                        {currencySymbol}
                      </Text>
                      <TextInput
                        style={[styles.budgetAmountInput, { color: themeColors.text }]}
                        placeholder="0.00"
                        placeholderTextColor={themeColors.textMuted}
                        keyboardType="numeric"
                        value={budgetAmount}
                        onChangeText={setBudgetAmount}
                      />
                    </View>

                    {/* Quick increment chips */}
                    <View style={styles.quickChipsRow}>
                      {[50, 100, 250, 500].map((inc) => (
                        <TouchableOpacity
                          key={inc}
                          style={[
                            styles.chipButton,
                            {
                              borderColor: themeColors.borderSubtle,
                              backgroundColor: themeColors.surface,
                            },
                          ]}
                          onPress={() => handleQuickAddBudget(inc)}
                        >
                          <Text style={[styles.chipText, { color: themeColors.textSecondary }]}>
                            +{currencySymbol}{inc}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Rollover Toggle */}
                    <View
                      style={[
                        styles.rolloverRow,
                        { borderTopColor: themeColors.borderSubtle },
                      ]}
                    >
                      <View style={styles.rolloverLeft}>
                        <Text style={[styles.rolloverLabel, { color: themeColors.text }]}>
                          Rollover Unspent
                        </Text>
                        <Text style={[styles.rolloverSubtext, { color: themeColors.textMuted }]}>
                          Add leftover limit to next month automatically
                        </Text>
                      </View>
                      <Switch
                        value={rollover}
                        onValueChange={(val) => {
                          triggerHaptic('selection');
                          setRollover(val);
                        }}
                        trackColor={{
                          false: themeColors.border,
                          true: themeColors.accent,
                        }}
                        thumbColor={themeColors.surface}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Delete Custom Category Button */}
            {isEditing && !isDefaultCategory && onDeleteCategory && (
              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  { borderColor: themeColors.error, backgroundColor: `${themeColors.error}10` },
                ]}
                onPress={handleDelete}
              >
                <Icon name="trash-can-outline" size={16} color={themeColors.error} />
                <Text style={[styles.deleteButtonText, { color: themeColors.error }]}>
                  DELETE CATEGORY
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Bottom Action Footer */}
          <View
            style={[
              styles.footerBar,
              { borderTopColor: themeColors.borderSubtle },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderColor: themeColors.border },
              ]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>
                CANCEL
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: themeColors.text },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={[styles.saveButtonText, { color: themeColors.background }]}>
                {isSubmitting
                  ? 'SAVING...'
                  : isEditing
                  ? 'SAVE CHANGES'
                  : 'CREATE CATEGORY'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '90%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.sm,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formScroll: {
    paddingHorizontal: spacing.lg,
  },
  formContent: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  sectionBlock: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.xs,
  },
  segmentButtonActive: {
    borderWidth: 1,
  },
  segmentText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  labelWithPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: borderRadius.none,
  },
  previewPillText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconGridItem: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.xs,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: spacing.md,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  budgetTitleBlock: {
    flex: 1,
  },
  budgetHeading: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  budgetSubheading: {
    fontSize: 10,
    marginTop: 1,
  },
  budgetInputsBlock: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  microLabel: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    marginRight: spacing.xs,
  },
  budgetAmountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.sm,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chipButton: {
    flex: 1,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
    fontVariant: ['tabular-nums'],
  },
  rolloverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
  },
  rolloverLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rolloverLabel: {
    fontSize: 12,
    fontWeight: typography.weights.medium,
  },
  rolloverSubtext: {
    fontSize: 10,
    marginTop: 2,
  },
  deleteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    marginTop: spacing.sm,
  },
  deleteButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  footerBar: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  saveButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
});
