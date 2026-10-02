/**
 * Purpose: Unified Categories & Budget Hub screen for ZeroWallet.
 * 
 * Aesthetic: Simplizum
 * - 1px razor hairline outlines
 * - 2-4px subtle corners
 * - Micro-KPI architecture block for total budget burn and remaining limits
 * - Architectural ledger rows with 2px hairline gauge and restrained color cues
 * - Fast inline Simplizum bottom sheet for creating/editing categories and budget ceilings
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import {
  CategoryBudgetService,
  type CategoryWithBudget,
  type BudgetSummary,
} from '../../services/categoryBudgetService';
import { CategoryLedgerRow } from '../../components/categories/CategoryLedgerRow';
import { CategoryBudgetModal } from '../../components/categories/CategoryBudgetModal';
import type { CategoryType } from '../../types/models';

type NavigationProp = StackNavigationProp<MainStackParamList>;

export default function CategoriesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId) || useAccountStore((s) => s.currentAccountId);

  const [activeTab, setActiveTab] = useState<CategoryType>('expense');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [expenses, setExpenses] = useState<CategoryWithBudget[]>([]);
  const [income, setIncome] = useState<CategoryWithBudget[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({
    totalBudgeted: 0,
    totalSpentOnBudgeted: 0,
    totalSpentAllExpenses: 0,
    totalRemaining: 0,
    overallPercentage: 0,
    budgetedCategoriesCount: 0,
    warningCategoriesCount: 0,
    exceededCategoriesCount: 0,
    totalIncomeThisMonth: 0,
    incomeCategoriesCount: 0,
    currency: 'USD',
  });

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CategoryWithBudget | null>(null);

  const service = useMemo(() => new CategoryBudgetService(), []);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await service.getCategoryBudgetData(
        currentUser.id,
        currentAccountId || ''
      );
      setExpenses(data.expenses);
      setIncome(data.income);
      setSummary(data.summary);
    } catch (error) {
      console.error('[CategoriesScreen] Failed to load category data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, currentAccountId, service]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    triggerHaptic('impactLight');
    loadData();
  };

  const handleOpenCreate = () => {
    triggerHaptic('selection');
    setSelectedItem(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (item: CategoryWithBudget) => {
    triggerHaptic('selection');
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleSaveCategory = async (payload: {
    id?: string;
    name: string;
    type: CategoryType;
    icon: string;
    color: string;
    budgetAmount?: number | null;
    rollover?: boolean;
  }) => {
    if (!currentUser) return;
    await service.saveCategoryAndBudget({
      ...payload,
      userId: currentUser.id,
      accountId: currentAccountId || '',
    });
    await loadData();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    await service.deleteCategory(categoryId, currentAccountId || '');
    await loadData();
  };

  // Filtered categories based on active tab & search query
  const displayedCategories = useMemo(() => {
    const list = activeTab === 'expense' ? expenses : income;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((item) => item.category.name.toLowerCase().includes(q));
  }, [activeTab, expenses, income, searchQuery]);

  // Master Hairline Gauge color
  let masterGaugeColor = themeColors.accent;
  if (summary.overallPercentage >= 100) {
    masterGaugeColor = themeColors.error;
  } else if (summary.overallPercentage >= 80) {
    masterGaugeColor = themeColors.warning;
  }

  const cappedOverallPercentage = Math.min(100, Math.max(0, summary.overallPercentage));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={themeColors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
      />

      {/* Simplizum Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: themeColors.borderSubtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerNavButton, { borderColor: themeColors.borderSubtle }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={18} color={themeColors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerSubtitle, { color: themeColors.textMuted }]}>
            CLASSIFICATION & LIMITS
          </Text>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            Categories & Budgets
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleOpenCreate}
          style={[
            styles.createButton,
            {
              backgroundColor: themeColors.surfaceElevated,
              borderColor: themeColors.border,
            },
          ]}
          activeOpacity={0.7}
        >
          <Icon name="plus" size={14} color={themeColors.text} />
          <Text style={[styles.createButtonText, { color: themeColors.text }]}>
            NEW
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Scroll */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.text}
          />
        }
      >
        <View style={styles.headerComponentsBlock}>
            {/* Architectural 2-way Tab Switcher */}
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
                  styles.segmentTab,
                  activeTab === 'expense' && [
                    styles.segmentTabActive,
                    {
                      backgroundColor: themeColors.surface,
                      borderColor: themeColors.border,
                    },
                  ],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setActiveTab('expense');
                }}
              >
                <Text
                  style={[
                    styles.segmentTabText,
                    {
                      color:
                        activeTab === 'expense'
                          ? themeColors.text
                          : themeColors.textMuted,
                      fontWeight:
                        activeTab === 'expense'
                          ? typography.weights.bold
                          : typography.weights.medium,
                    },
                  ]}
                >
                  EXPENSES ({expenses.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentTab,
                  activeTab === 'income' && [
                    styles.segmentTabActive,
                    {
                      backgroundColor: themeColors.surface,
                      borderColor: themeColors.border,
                    },
                  ],
                ]}
                onPress={() => {
                  triggerHaptic('selection');
                  setActiveTab('income');
                }}
              >
                <Text
                  style={[
                    styles.segmentTabText,
                    {
                      color:
                        activeTab === 'income'
                          ? themeColors.text
                          : themeColors.textMuted,
                      fontWeight:
                        activeTab === 'income'
                          ? typography.weights.bold
                          : typography.weights.medium,
                    },
                  ]}
                >
                  INCOME ({income.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Micro-KPI Architectural Block */}
            {activeTab === 'expense' ? (
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <View style={styles.kpiGrid}>
                  <View style={styles.kpiCol}>
                    <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                      TOTAL BUDGET
                    </Text>
                    <Text style={[styles.kpiValue, { color: themeColors.text }]}>
                      {formatCurrency(summary.totalBudgeted, summary.currency)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.kpiDivider,
                      { backgroundColor: themeColors.borderSubtle },
                    ]}
                  />

                  <View style={styles.kpiCol}>
                    <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                      TOTAL SPENT
                    </Text>
                    <Text style={[styles.kpiValue, { color: themeColors.text }]}>
                      {formatCurrency(summary.totalSpentOnBudgeted, summary.currency)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.kpiDivider,
                      { backgroundColor: themeColors.borderSubtle },
                    ]}
                  />

                  <View style={styles.kpiCol}>
                    <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                      REMAINING
                    </Text>
                    <Text
                      style={[
                        styles.kpiValue,
                        {
                          color:
                            summary.totalRemaining > 0
                              ? themeColors.text
                              : themeColors.error,
                        },
                      ]}
                    >
                      {formatCurrency(summary.totalRemaining, summary.currency)}
                    </Text>
                  </View>
                </View>

                {/* Master Hairline Burn Gauge */}
                <View style={styles.masterGaugeBlock}>
                  <View
                    style={[
                      styles.masterGaugeTrack,
                      { backgroundColor: themeColors.borderSubtle },
                    ]}
                  >
                    <View
                      style={[
                        styles.masterGaugeFill,
                        {
                          backgroundColor: masterGaugeColor,
                          width: `${cappedOverallPercentage}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.gaugeMetaRow}>
                    <Text style={[styles.gaugeMetaText, { color: themeColors.textMuted }]}>
                      {summary.budgetedCategoriesCount} of {expenses.length} budgeted
                    </Text>
                    <Text
                      style={[
                        styles.gaugeMetaText,
                        {
                          color:
                            summary.exceededCategoriesCount > 0
                              ? themeColors.error
                              : summary.warningCategoriesCount > 0
                              ? themeColors.warning
                              : themeColors.textSecondary,
                          fontWeight: typography.weights.bold,
                        },
                      ]}
                    >
                      {Math.round(summary.overallPercentage)}% BURN
                      {summary.exceededCategoriesCount > 0
                        ? ` · ${summary.exceededCategoriesCount} OVER`
                        : ''}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <View style={styles.kpiGrid}>
                  <View style={styles.kpiCol}>
                    <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                      TOTAL INFLOW THIS MONTH
                    </Text>
                    <Text style={[styles.kpiValue, { color: themeColors.success }]}>
                      +{formatCurrency(summary.totalIncomeThisMonth, summary.currency)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.kpiDivider,
                      { backgroundColor: themeColors.borderSubtle },
                    ]}
                  />

                  <View style={styles.kpiCol}>
                    <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                      ACTIVE STREAMS
                    </Text>
                    <Text style={[styles.kpiValue, { color: themeColors.text }]}>
                      {summary.incomeCategoriesCount} categories
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Quick Search Input */}
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: themeColors.surfaceElevated,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <Icon name="magnify" size={16} color={themeColors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder={`Search ${activeTab} categories...`}
                placeholderTextColor={themeColors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close-circle" size={16} color={themeColors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Section Micro-Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: themeColors.textMuted }]}>
                {activeTab.toUpperCase()} CLASSIFICATIONS ({displayedCategories.length})
              </Text>
              <Text style={[styles.sectionSubheading, { color: themeColors.textMuted }]}>
                TAP ROW TO CONFIGURE
              </Text>
            </View>
          </View>

        {/* Categories Ledger List */}
        {displayedCategories.length > 0 ? (
          displayedCategories.map((item) => (
            <CategoryLedgerRow
              key={item.category.id}
              item={item}
              currency={summary.currency}
              onPress={handleOpenEdit}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Icon
              name="tag-outline"
              size={36}
              color={themeColors.textMuted}
              style={{ opacity: 0.5 }}
            />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              {loading ? 'Loading categories...' : 'No categories found'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first category to organize transactions.'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={[
                  styles.emptyAddButton,
                  {
                    borderColor: themeColors.border,
                    backgroundColor: themeColors.surfaceElevated,
                  },
                ]}
                onPress={handleOpenCreate}
              >
                <Text style={[styles.emptyAddButtonText, { color: themeColors.text }]}>
                  + CREATE CATEGORY
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Inline Bottom Sheet Modal */}
      <CategoryBudgetModal
        visible={modalVisible}
        item={selectedItem}
        initialType={activeTab}
        currency={summary.currency}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveCategory}
        onDeleteCategory={handleDeleteCategory}
      />
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  createButtonText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  headerComponentsBlock: {
    paddingTop: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 2,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.xs,
  },
  segmentTabActive: {
    borderWidth: 1,
  },
  segmentTabText: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  kpiCard: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 28,
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  masterGaugeBlock: {
    marginTop: spacing.md,
    gap: 6,
  },
  masterGaugeTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  masterGaugeFill: {
    height: 2,
    borderRadius: 1,
  },
  gaugeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeMetaText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  sectionHeading: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  sectionSubheading: {
    fontSize: 8,
    fontWeight: typography.weights.medium,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyAddButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  emptyAddButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
});
