import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Category } from '../../types/models';

interface CategoryPickerProps {
  categories: Category[];
  selectedCategory?: Category;
  onSelectCategory: (category: Category) => void;
  type?: 'income' | 'expense';
  label?: string;
  error?: string;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  type,
  label = 'Category',
  error,
}) => {
  const [modalVisible, setModalVisible] = React.useState(false);

  const filteredCategories = useMemo(() => {
    console.log('[CategoryPicker] Raw categories:', categories.map(c => ({
      name: c.name,
      type: c.type,
      typeOf: typeof c.type
    })));
    console.log('[CategoryPicker] Filter type:', type, 'typeOf:', typeof type);
    
    if (!type) {
      console.log('[CategoryPicker] No type filter, returning all categories');
      return categories;
    }
    
    const filtered = categories.filter(cat => {
      const matches = cat.type === type;
      console.log(`[CategoryPicker] Category "${cat.name}" type="${cat.type}" matches "${type}"? ${matches}`);
      return matches;
    });
    
    console.log('[CategoryPicker] Filtering result:', {
      type,
      totalCategories: categories.length,
      filteredCount: filtered.length,
      filtered: filtered.map(c => c.name),
    });
    return filtered;
  }, [categories, type]);

  const handleSelectCategory = (category: Category) => {
    onSelectCategory(category);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[
          styles.picker,
          error && styles.pickerError,
        ]}
        onPress={() => setModalVisible(true)}
      >
        {selectedCategory ? (
          <View style={styles.selectedCategory}>
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: selectedCategory.color },
              ]}
            >
              <MaterialCommunityIcons
                name={selectedCategory.icon as any}
                size={20}
                color={colors.neutral.white}
              />
            </View>
            <Text style={styles.categoryName}>{selectedCategory.name}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>Select a category</Text>
        )}
        <MaterialCommunityIcons
          name="chevron-down"
          size={24}
          color={colors.neutral.gray500}
        />
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.neutral.gray700}
                />
              </TouchableOpacity>
            </View>

            {filteredCategories.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="folder-open"
                  size={48}
                  color={colors.neutral.gray400}
                />
                <Text style={styles.emptyText}>No categories available</Text>
                <Text style={styles.emptySubtext}>
                  {type ? `Create a new ${type} category to get started` : 'No categories found'}
                </Text>
              </View>
            ) : (
              <FlashList estimatedItemSize={56}
                data={filteredCategories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.categoryItem,
                      selectedCategory?.id === item.id && styles.categoryItemSelected,
                    ]}
                    onPress={() => handleSelectCategory(item)}
                  >
                    <View
                      style={[
                        styles.categoryIcon,
                        { backgroundColor: item.color },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={24}
                        color={colors.neutral.white}
                      />
                    </View>
                    <Text style={styles.categoryItemName}>{item.name}</Text>
                    {selectedCategory?.id === item.id && (
                      <MaterialCommunityIcons
                        name="check"
                        size={24}
                        color={colors.primary.main}
                      />
                    )}
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '500',
    color: colors.neutral.gray700,
    marginBottom: spacing.xs,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray300,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pickerError: {
    borderColor: colors.semantic.error,
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    ...typography.body,
    color: colors.neutral.gray900,
    fontWeight: '500',
  },
  placeholder: {
    ...typography.body,
    color: colors.neutral.gray500,
  },
  error: {
    ...typography.caption,
    color: colors.semantic.error,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    minHeight: 300,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.neutral.gray900,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    ...typography.h4,
    color: colors.neutral.gray700,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.neutral.gray500,
    textAlign: 'center',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  categoryItemSelected: {
    backgroundColor: colors.primary.light,
  },
  categoryItemName: {
    ...typography.body,
    color: colors.neutral.gray900,
    marginLeft: spacing.md,
    flex: 1,
  },
});
