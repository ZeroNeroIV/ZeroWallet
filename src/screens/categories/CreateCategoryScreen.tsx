/**
 * Purpose: Create or edit custom income/expense categories with icon and color selection
 * 
 * Inputs:
 *   - route.params.type ('income' | 'expense'): Category type when creating new
 *   - route.params.mode ('edit'): Edit mode flag
 *   - route.params.categoryId (string): Category ID when editing
 * 
 * Outputs:
 *   - Returns (JSX.Element): Category creation/edit form
 * 
 * Side effects:
 *   - Creates new category in database
 *   - Updates existing category in database
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Input } from '../../components/forms/Input';
import { Button } from '../../components/forms/Button';
import { useAuthStore } from '../../store/authStore';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { validateRequired } from '../../utils/validators';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { Category, CategoryType } from '../../types/models';
import { useThemeColors } from '../../hooks/useThemeColors';

type CreateCategoryNavigationProp = StackNavigationProp<
  MainStackParamList,
  'CreateCategory'
>;

type CreateCategoryRouteProp = RouteProp<MainStackParamList, 'CreateCategory'>;

// Available category icons (MaterialCommunityIcons)
const EXPENSE_ICONS = [
  'food',
  'food-fork-drink',
  'silverware-fork-knife',
  'coffee',
  'cart',
  'shopping',
  'car',
  'bus',
  'train',
  'airplane',
  'gas-station',
  'movie',
  'music',
  'gamepad-variant',
  'controller',
  'receipt',
  'file-document',
  'home',
  'lightning-bolt',
  'water',
  'medical-bag',
  'hospital-box',
  'pill',
  'heart-pulse',
  'school',
  'book-open',
  'pencil',
  'dumbbell',
  'run',
  'tshirt-crew',
  'shoe-sneaker',
  'phone',
  'laptop',
  'television',
  'gift',
  'paw',
  'flower',
  'hammer',
  'wrench',
  'brush',
  'palette',
];

const INCOME_ICONS = [
  'briefcase',
  'account-tie',
  'office-building',
  'laptop',
  'desktop-mac',
  'code-tags',
  'cash',
  'cash-multiple',
  'currency-usd',
  'bank',
  'chart-line',
  'trending-up',
  'finance',
  'chart-areaspline',
  'gift',
  'gift-outline',
  'hand-coin',
  'piggy-bank',
  'wallet',
  'sale',
];

// Available colors (expanded palette)
const CATEGORY_COLORS = [
  colors.category.red,
  colors.category.blue,
  colors.category.yellow,
  colors.category.green,
  colors.category.pink,
  colors.category.purple,
  colors.category.skyBlue,
  colors.category.lavender,
  colors.category.teal,
  colors.category.navy,
  colors.category.orange,
  colors.category.fuchsia,
  colors.category.indigo,
  '#E63946',
  '#F77F00',
  '#06FFA5',
  '#8338EC',
  '#FB5607',
  '#FF006E',
  '#3A86FF',
  '#FFB703',
  '#8AC926',
  '#D00000',
  '#6A4C93',
];

export default function CreateCategoryScreen() {
  const navigation = useNavigation<CreateCategoryNavigationProp>();
  const route = useRoute<CreateCategoryRouteProp>();
  const currentUser = useAuthStore((state) => state.currentUser);
  const themeColors = useThemeColors();

  const isEditMode = 'mode' in route.params && route.params.mode === 'edit';
  const categoryType: CategoryType = 'type' in route.params ? route.params.type : 'expense';
  const categoryId = 'categoryId' in route.params ? route.params.categoryId : undefined;

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const availableIcons = categoryType === 'expense' ? EXPENSE_ICONS : INCOME_ICONS;
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Load category data if editing
  useEffect(() => {
    if (isEditMode && categoryId) {
      loadCategory();
    } else {
      // Set defaults for new category
      setSelectedIcon(availableIcons[0]);
      setSelectedColor(CATEGORY_COLORS[0]);
    }
  }, []);

  const loadCategory = async () => {
    if (!categoryId) return;

    try {
      const categoryRepo = new CategoryRepository();
      const category = await categoryRepo.findById(categoryId);

      if (category) {
        setName(category.name);
        setSelectedIcon(category.icon);
        setSelectedColor(category.color);
      } else {
        Alert.alert('Error', 'Category not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('[CreateCategory] Failed to load category:', error);
      Alert.alert('Error', 'Failed to load category');
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'User not found');
      return;
    }

    // Validate
    const nameError = validateRequired(name, 'Category name');
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }

    if (!selectedIcon) {
      Alert.alert('Error', 'Please select an icon');
      return;
    }

    if (!selectedColor) {
      Alert.alert('Error', 'Please select a color');
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const categoryRepo = new CategoryRepository();

      if (isEditMode && categoryId) {
        // Update existing category
        await categoryRepo.update(categoryId, {
          name: name.trim(),
          icon: selectedIcon,
          color: selectedColor,
        });

        Alert.alert('Success', 'Category updated successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // Create new category
        await categoryRepo.create({
          userId: currentUser.id,
          name: name.trim(),
          type: categoryType,
          icon: selectedIcon,
          color: selectedColor,
          isDefault: false,
        });

        Alert.alert('Success', 'Category created successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      console.error('[CreateCategory] Failed to save category:', error);
      Alert.alert('Error', 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Category Name */}
      <Input
        label="Category Name"
        placeholder="e.g., Groceries, Rent, Bonus"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setErrors({});
        }}
        error={errors.name}
        leftIcon={categoryType === 'expense' ? 'minus-circle' : 'plus-circle'}
        autoFocus={!isEditMode}
      />

      {/* Category Type Badge */}
      <View style={styles.typeBadge}>
        <Icon
          name={categoryType === 'expense' ? 'minus-circle' : 'plus-circle'}
          size={16}
          color={categoryType === 'expense' ? colors.semantic.error : colors.semantic.success}
        />
        <Text
          style={[
            styles.typeBadgeText,
            {
              color:
                categoryType === 'expense'
                  ? colors.semantic.error
                  : colors.semantic.success,
            },
          ]}
        >
          {categoryType === 'expense' ? 'Expense Category' : 'Income Category'}
        </Text>
      </View>

      {/* Icon Picker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose Icon</Text>
        <View style={styles.iconGrid}>
          {availableIcons.map((icon) => (
            <TouchableOpacity
              key={icon}
              style={[
                styles.iconOption,
                selectedIcon === icon && styles.iconOptionSelected,
                { borderColor: selectedColor },
              ]}
              onPress={() => setSelectedIcon(icon)}
            >
              <Icon
                name={icon}
                size={28}
                color={selectedIcon === icon ? selectedColor : themeColors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Color Picker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose Color</Text>
        <View style={styles.colorGrid}>
          {CATEGORY_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color },
                selectedColor === color && styles.colorOptionSelected,
              ]}
              onPress={() => setSelectedColor(color)}
            >
              {selectedColor === color && (
                <Icon name="check" size={20} color={themeColors.surface} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Preview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preview</Text>
        <View style={styles.preview}>
          <View style={[styles.previewCircle, { backgroundColor: selectedColor }]}>
            <Icon name={selectedIcon} size={32} color={themeColors.surface} />
          </View>
          <Text style={styles.previewText}>{name || 'Category Name'}</Text>
        </View>
      </View>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title={isEditMode ? 'Update Category' : 'Create Category'}
          onPress={handleSave}
          loading={loading}
          leftIcon={<Icon name={isEditMode ? 'check' : 'plus'} size={20} color="#FFF" />}
        />
      </View>
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
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: themeColors.surface,
    borderRadius: borderRadius.round,
    gap: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  typeBadgeText: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 13,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    color: themeColors.text,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconOption: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: themeColors.border,
    backgroundColor: themeColors.surface,
  },
  iconOptionSelected: {
    borderWidth: 3,
    backgroundColor: themeColors.background,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: themeColors.text,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: themeColors.surface,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
    ...{
      shadowColor: themeColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  previewCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    ...typography.h3,
    color: themeColors.text,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
