/**
 * Purpose: Full-screen Simplizum Category & Budget creation/editing screen.
 * 
 * Supports:
 * - Route params (type, mode, categoryId)
 * - Category classification (icon, name, architectural color palette)
 * - Monthly budget ceiling with rollover toggle
 * - Fast validation and haptic feedback
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  Switch,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { getCurrencySymbol } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { BudgetRepository } from '../../database/repositories/BudgetRepository';
import { CategoryBudgetService } from '../../services/categoryBudgetService';
import type { CategoryType } from '../../types/models';

type NavigationProp = StackNavigationProp<MainStackParamList, 'CreateCategory'>;
type ScreenRouteProp = RouteProp<MainStackParamList, 'CreateCategory'>;

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
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
  '#78716C',
  '#0EA5E9',
];

export default function CreateCategoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId) || useAccountStore((s) => s.currentAccountId);

  const routeParams = route.params || {};
  const isEditMode = 'mode' in routeParams && routeParams.mode === 'edit';
  const categoryId = 'categoryId' in routeParams ? routeParams.categoryId : undefined;
  const initialType: CategoryType = 'type' in routeParams && routeParams.type ? routeParams.type : 'expense';

  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>(initialType);
  const [selectedIcon, setSelectedIcon] = useState(initialType === 'expense' ? EXPENSE_ICONS[0] : INCOME_ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(ARCHITECTURAL_COLORS[3]);
  const [isDefault, setIsDefault] = useState(false);

  // Budget
  const [hasBudget, setHasBudget] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [rollover, setRollover] = useState(false);
  const [existingBudgetId, setExistingBudgetId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const currencySymbol = useMemo(() => getCurrencySymbol('USD'), []);

  useEffect(() => {
    if (isEditMode && categoryId) {
      loadCategoryDetails(categoryId);
    }
  }, [isEditMode, categoryId]);

  const loadCategoryDetails = async (id: string) => {
    try {
      setLoading(true);
      const catRepo = new CategoryRepository();
      const cat = await catRepo.findById(id);
      if (cat) {
        setName(cat.name);
        setType(cat.type);
        setSelectedIcon(cat.icon || (cat.type === 'expense' ? EXPENSE_ICONS[0] : INCOME_ICONS[0]));
        setSelectedColor(cat.color || ARCHITECTURAL_COLORS[0]);
        setIsDefault(cat.isDefault);

        if (cat.type === 'expense' && currentAccountId) {
          const budgetRepo = new BudgetRepository();
          const budget = await budgetRepo.findByCategory(currentAccountId, cat.id);
          if (budget && budget.amount > 0) {
            setHasBudget(true);
            setBudgetAmount(budget.amount.toString());
            setRollover(Boolean(budget.rollover));
            setExistingBudgetId(budget.id);
          }
        }
      }
    } catch (err) {
      console.error('[CreateCategoryScreen] Failed to load category:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!currentUser) return;
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a category name');
      return;
    }

    let parsedBudget: number | null | undefined = undefined;
    if (type === 'expense') {
      if (hasBudget) {
        const num = parseFloat(budgetAmount);
        if (isNaN(num) || num <= 0) {
          Alert.alert('Invalid Budget', 'Please enter a valid monthly spending limit greater than 0');
          return;
        }
        parsedBudget = num;
      } else if (existingBudgetId) {
        parsedBudget = null;
      }
    }

    try {
      setSaving(true);
      triggerHaptic('notificationSuccess');
      const service = new CategoryBudgetService();
      await service.saveCategoryAndBudget({
        id: isEditMode ? categoryId : undefined,
        userId: currentUser.id,
        accountId: currentAccountId || '',
        name: name.trim(),
        type,
        icon: selectedIcon,
        color: selectedColor,
        budgetAmount: parsedBudget,
        rollover,
      });

      navigation.goBack();
    } catch (err: any) {
      console.error('[CreateCategoryScreen] Save failed:', err);
      Alert.alert('Error', err?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!categoryId || isDefault) return;
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('notificationWarning');
              const service = new CategoryBudgetService();
              await service.deleteCategory(categoryId, currentAccountId || '');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={themeColors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
      />

      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: themeColors.borderSubtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerNavButton, { borderColor: themeColors.borderSubtle }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" size={18} color={themeColors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerSubtitle, { color: themeColors.textMuted }]}>
            {isEditMode ? 'MODIFY ATTRIBUTES' : 'NEW CLASSIFICATION'}
          </Text>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            {isEditMode ? 'Edit Category' : 'Create Category'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[
            styles.saveHeaderButton,
            { backgroundColor: themeColors.text },
          ]}
        >
          <Text style={[styles.saveHeaderText, { color: themeColors.background }]}>
            {saving ? '...' : 'SAVE'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Type Selector (New Category Only) */}
        {!isEditMode && (
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
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              },
            ]}
            placeholder="e.g. Groceries, Restaurants, Cloud Services"
            placeholderTextColor={themeColors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Icon Grid */}
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

        {/* Architectural Palette */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            ARCHITECTURAL COLOR PALETTE
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
                  {isSelected && <Icon name="check" size={12} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Monthly Budget Target Section (Expense only) */}
        {type === 'expense' && (
          <View
            style={[
              styles.budgetCard,
              {
                backgroundColor: themeColors.surface,
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
                  if (val && !budgetAmount) setBudgetAmount('500');
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
                  BUDGET CEILING
                </Text>
                <View
                  style={[
                    styles.amountInputRow,
                    {
                      backgroundColor: themeColors.surfaceElevated,
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

        {/* Delete Category Button (Custom only) */}
        {isEditMode && !isDefault && (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerNavButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  saveHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.xs,
  },
  saveHeaderText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
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
});
