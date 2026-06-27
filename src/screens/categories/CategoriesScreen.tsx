/**
 * Purpose: Displays all income and expense categories with edit/delete actions
 * 
 * Inputs:
 *   - None (navigation screen)
 * 
 * Outputs:
 *   - Returns (JSX.Element): Categories list screen with tabs for income/expense
 * 
 * Side effects:
 *   - Loads categories from database on mount and focus
 *   - Navigates to CreateCategory screen
 *   - Deletes custom categories (not default ones)
 *   - Refreshes category list
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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import type { Category, CategoryType } from '../../types/models';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Button } from '../../components/forms/Button';
import { useThemeColors } from '../../hooks/useThemeColors';

type CategoriesNavigationProp = StackNavigationProp<
  MainStackParamList,
  'CategoriesScreen'
>;

export default function CategoriesScreen() {
  const navigation = useNavigation<CategoriesNavigationProp>();
  const currentUser = useAuthStore((state) => state.currentUser);
  const themeColors = useThemeColors();

  const [activeTab, setActiveTab] = useState<CategoryType>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const loadCategories = async () => {
    if (!currentUser) return;

    try {
      const categoryRepo = new CategoryRepository();
      const allCategories = await categoryRepo.findByUser(currentUser.id);
      setCategories(allCategories);
    } catch (error) {
      console.error('[CategoriesScreen] Failed to load categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [currentUser])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadCategories();
  };

  const handleCreateCategory = () => {
    navigation.navigate('CreateCategory', { type: activeTab });
  };

  const handleEditCategory = (category: Category) => {
    if (category.isDefault) {
      Alert.alert('Cannot Edit', 'Default categories cannot be edited');
      return;
    }

    navigation.navigate('CreateCategory', {
      mode: 'edit',
      categoryId: category.id,
    });
  };

  const handleDeleteCategory = (category: Category) => {
    if (category.isDefault) {
      Alert.alert('Cannot Delete', 'Default categories cannot be deleted');
      return;
    }

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const categoryRepo = new CategoryRepository();
              await categoryRepo.delete(category.id);
              Alert.alert('Success', 'Category deleted successfully');
              loadCategories();
            } catch (error) {
              console.error('[CategoriesScreen] Failed to delete category:', error);
              Alert.alert('Error', 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const filteredCategories = categories.filter((cat) => cat.type === activeTab);

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() => handleEditCategory(item)}
      activeOpacity={0.7}
    >
      <View style={styles.categoryLeft}>
        <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
          <Icon name={item.icon} size={24} color={themeColors.surface} />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.name}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.categoryActions}>
        {!item.isDefault && (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditCategory(item)}
            >
              <Icon name="pencil" size={20} color={colors.primary.main} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteCategory(item)}
            >
              <Icon name="delete" size={20} color={colors.semantic.error} />
            </TouchableOpacity>
          </>
        )}
        {item.isDefault && (
          <Icon name="lock" size={20} color={themeColors.textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'expense' && styles.tabActive]}
          onPress={() => setActiveTab('expense')}
        >
          <Icon
            name="minus-circle"
            size={20}
            color={activeTab === 'expense' ? colors.neutral.white : themeColors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'expense' && styles.tabTextActive,
            ]}
          >
            Expenses
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'income' && styles.tabActive]}
          onPress={() => setActiveTab('income')}
        >
          <Icon
            name="plus-circle"
            size={20}
            color={activeTab === 'income' ? colors.neutral.white : themeColors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'income' && styles.tabTextActive,
            ]}
          >
            Income
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category List */}
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderCategoryItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon
              name={activeTab === 'expense' ? 'folder-outline' : 'cash-multiple'}
              size={64}
              color={themeColors.textSecondary}
            />
            <Text style={styles.emptyTitle}>No Custom Categories</Text>
            <Text style={styles.emptySubtitle}>
              Create your own {activeTab} categories
            </Text>
          </View>
        }
      />

      {/* Add Category Button */}
      <View style={styles.footer}>
        <Button
          title={`Add ${activeTab === 'expense' ? 'Expense' : 'Income'} Category`}
          onPress={handleCreateCategory}
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
  tabContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: themeColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: themeColors.background,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary.main,
  },
  tabText: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  tabTextActive: {
    color: colors.neutral.white,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  categoryItem: {
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
  categoryLeft: {
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
  categoryInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  categoryName: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: themeColors.border,
    borderRadius: borderRadius.sm,
  },
  defaultBadgeText: {
    ...typography.caption,
    color: themeColors.textSecondary,
    fontSize: 10,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
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
  },
  footer: {
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
});
