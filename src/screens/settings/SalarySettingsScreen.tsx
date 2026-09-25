/**
 * Purpose: Configure automatic monthly salary settings
 * 
 * Inputs:
 *   - navigation (SalarySettingsScreenProps): Navigation object from React Navigation
 * 
 * Outputs:
 *   - Returns (JSX.Element): Salary configuration form
 * 
 * Side effects:
 *   - Updates salary settings in store
 *   - Navigates back to settings screen on save
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { AmountInput } from '../../components/forms/AmountInput';
import { Button } from '../../components/forms/Button';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ALL_WALLETS, WALLET_META, walletShortName, ordinalDay } from '../../utils/wallets';
import type { Category, VaultType } from '../../types/models';

const SalarySettingsScreen = ({ navigation }: any) => {
  const { salarySettings, updateSalarySettings } = useSettingsStore();
  const { currentAccountId, currentUser } = useAuthStore();
  const themeColors = useThemeColors();

  const [isEnabled, setIsEnabled] = useState(salarySettings.isEnabled);
  const [amount, setAmount] = useState(salarySettings.amount.toString());
  const [selectedVault, setSelectedVault] = useState<VaultType>(salarySettings.targetVault);
  const [payDay, setPayDay] = useState(salarySettings.payDay ?? 1);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPayDayPicker, setShowPayDayPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Load income categories
  useEffect(() => {
    const loadCategories = async () => {
      if (!currentUser) return;

      const categoryRepo = new CategoryRepository();
      const incomeCategories = await categoryRepo.findByUserAndType(currentUser.id, 'income');
      setCategories(incomeCategories);

      // Pre-select current category
      if (salarySettings.categoryId) {
        const current = incomeCategories.find((c: Category) => c.id === salarySettings.categoryId);
        if (current) {
          setSelectedCategory(current);
        }
      } else {
        // Auto-select "Salary" category if exists
        const salaryCategory = incomeCategories.find((c: Category) => c.name === 'Salary');
        if (salaryCategory) {
          setSelectedCategory(salaryCategory);
        }
      }
    };

    loadCategories();
  }, [currentUser, salarySettings.categoryId]);

  // Handle save
  const handleSave = async () => {
    // Turning off only needs to persist the disabled state
    if (!isEnabled) {
      setIsSaving(true);
      updateSalarySettings({ isEnabled: false });
      const { cancelSalaryReminder } = await import('../../services/notifications/scheduleNudges');
      await cancelSalaryReminder();
      setTimeout(() => {
        setIsSaving(false);
        navigation.goBack();
      }, 300);
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsSaving(true);

    // Import the auto salary task to get the schedule initializer
    const { initializeAutoSalarySchedule } = await import('../../services/backgroundTasks/autoSalaryTask');

    // Calculate next processing date (next payday)
    const nextProcessing = initializeAutoSalarySchedule(payDay);

    updateSalarySettings({
      isEnabled,
      amount: numAmount,
      categoryId: selectedCategory.id,
      targetVault: selectedVault,
      payDay,
      nextProcessing,
    });

    // Refresh the salary-day reminder to the new payday
    const { scheduleSalaryReminder } = await import('../../services/notifications/scheduleNudges');
    if (isEnabled) {
      await scheduleSalaryReminder();
    }

    setTimeout(() => {
      setIsSaving(false);
      navigation.goBack();
    }, 300);
  };

  // Render vault option
  const renderVaultOption = (vault: VaultType, icon: string, label: string) => {
    const isSelected = selectedVault === vault;

    return (
      <TouchableOpacity
        key={vault}
        style={[styles.vaultOption, isSelected && styles.vaultOptionSelected]}
        onPress={() => setSelectedVault(vault)}
      >
        <MaterialCommunityIcons
          name={icon}
          size={24}
          color={isSelected ? themeColors.primary : themeColors.textSecondary}
        />
        <Text
          style={[
            styles.vaultOptionText,
            isSelected && styles.vaultOptionTextSelected,
          ]}
        >
          {label}
        </Text>
        {isSelected && (
          <MaterialCommunityIcons
            name="check-circle"
            size={20}
            color={themeColors.primary}
          />
        )}
      </TouchableOpacity>
    );
  };

  // Render category item
  const renderCategoryItem = ({ item }: { item: Category }) => {
    const isSelected = selectedCategory?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
        onPress={() => {
          setSelectedCategory(item);
          setShowCategoryPicker(false);
        }}
      >
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: item.color + '30' },
          ]}
        >
          <MaterialCommunityIcons
            name={item.icon}
            size={20}
            color={item.color}
          />
        </View>
        <Text style={styles.categoryName}>{item.name}</Text>
        {isSelected && (
          <MaterialCommunityIcons
            name="check"
            size={20}
            color={themeColors.primary}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Enable/Disable Toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Text style={styles.toggleLabel}>Enable Auto-Salary</Text>
              <Text style={styles.toggleDescription}>
                Automatically add salary on the {ordinalDay(payDay)} of each month
              </Text>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={setIsEnabled}
              trackColor={{
                false: themeColors.border,
                true: themeColors.primaryLight,
              }}
              thumbColor={isEnabled ? themeColors.primary : themeColors.textSecondary}
            />
          </View>
        </View>

        {/* Salary Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Monthly Salary Amount</Text>
          <AmountInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.000"
            editable={isEnabled}
          />
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <TouchableOpacity
            style={styles.categorySelector}
            onPress={() => isEnabled && setShowCategoryPicker(true)}
            disabled={!isEnabled}
          >
            {selectedCategory ? (
              <View style={styles.selectedCategoryContent}>
                <View
                  style={[
                    styles.selectedCategoryIcon,
                    { backgroundColor: selectedCategory.color + '30' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={selectedCategory.icon}
                    size={20}
                    color={selectedCategory.color}
                  />
                </View>
                <Text style={styles.selectedCategoryText}>
                  {selectedCategory.name}
                </Text>
              </View>
            ) : (
              <Text style={styles.placeholderText}>Select Category</Text>
            )}
            <MaterialCommunityIcons
              name="chevron-down"
              size={24}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Payday */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Salary Day</Text>
          <TouchableOpacity
            style={styles.categorySelector}
            onPress={() => isEnabled && setShowPayDayPicker(true)}
            disabled={!isEnabled}
          >
            <View style={styles.selectedCategoryContent}>
              <View style={styles.selectedCategoryIcon}>
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={20}
                  color={themeColors.primary}
                />
              </View>
              <Text style={styles.selectedCategoryText}>
                {ordinalDay(payDay)} of each month
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-down"
              size={24}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Target Wallet */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Target Wallet</Text>
          <View style={styles.vaultGrid}>
            {ALL_WALLETS.map((wallet) => renderVaultOption(wallet, WALLET_META[wallet].icon, walletShortName(wallet)))}
          </View>
        </View>

        {/* Info Box */}
        {isEnabled && (
          <View style={styles.infoBox}>
            <MaterialCommunityIcons
              name="information-outline"
              size={20}
              color={themeColors.primary}
            />
            <Text style={styles.infoText}>
              Your salary will be automatically added to your {walletShortName(selectedVault)} wallet on the
              {ordinalDay(payDay)} of each month. You'll receive a notification when processed.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title={isSaving ? 'Saving...' : 'Save Settings'}
          onPress={handleSave}
          disabled={isSaving || (isEnabled && (!selectedCategory || !amount))}
          loading={isSaving}
        />
      </View>

      {/* Payday Picker Modal */}
      <Modal
        visible={showPayDayPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayDayPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Salary Day</Text>
              <TouchableOpacity onPress={() => setShowPayDayPicker(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={themeColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.dayGrid}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const isSelected = payDay === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayOption, isSelected && styles.dayOptionSelected]}
                    onPress={() => {
                      setPayDay(day);
                      setShowPayDayPicker(false);
                    }}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={themeColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories}
              renderItem={renderCategoryItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.categoryList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  section: {
    backgroundColor: themeColors.surface,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  toggleLabel: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: 4,
  },
  toggleDescription: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  sectionLabel: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: spacing.sm,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: themeColors.background,
    borderWidth: 1,
    borderColor: themeColors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  selectedCategoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedCategoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  selectedCategoryText: {
    ...typography.body,
    color: themeColors.text,
    fontWeight: '500',
  },
  placeholderText: {
    ...typography.body,
    color: themeColors.textSecondary,
  },
  vaultGrid: {
    gap: spacing.sm,
  },
  vaultOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.background,
    borderWidth: 1,
    borderColor: themeColors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  vaultOptionSelected: {
    backgroundColor: themeColors.primary + '20',
    borderColor: themeColors.primary,
  },
  vaultOptionText: {
    ...typography.body,
    color: themeColors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  vaultOptionTextSelected: {
    color: themeColors.primary,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: themeColors.primary + '15',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: themeColors.primary,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    backgroundColor: themeColors.surface,
    padding: spacing.md,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: themeColors.text,
  },
  categoryList: {
    padding: spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    marginVertical: 4,
    gap: spacing.sm,
  },
  categoryItemSelected: {
    backgroundColor: themeColors.primary + '15',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    ...typography.body,
    color: themeColors.text,
    flex: 1,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: spacing.md,
  },
  dayOption: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.background,
  },
  dayOptionSelected: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
  },
  dayText: {
    ...typography.body,
    color: themeColors.text,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
});

export default SalarySettingsScreen;
