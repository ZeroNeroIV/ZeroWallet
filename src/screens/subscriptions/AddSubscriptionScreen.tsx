/**
 * Purpose: Create or edit subscriptions with billing day picker and category selection
 * 
 * Inputs:
 *   - route.params.mode ('edit'): Edit mode flag
 *   - route.params.subscriptionId (string): Subscription ID when editing
 * 
 * Outputs:
 *   - Returns (JSX.Element): Subscription creation/edit form
 * 
 * Side effects:
 *   - Creates new subscription in database
 *   - Updates existing subscription in database
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
import { AmountInput } from '../../components/forms/AmountInput';
import { CategoryPicker } from '../../components/forms/CategoryPicker';
import { useAuthStore } from '../../store/authStore';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { validateRequired } from '../../utils/validators';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Category, VaultType } from '../../types/models';

type AddSubscriptionNavigationProp = StackNavigationProp<
  MainStackParamList,
  'AddSubscription'
>;

type AddSubscriptionRouteProp = RouteProp<MainStackParamList, 'AddSubscription'>;

const VAULT_OPTIONS: { value: VaultType; label: string; icon: string }[] = [
  { value: 'main', label: 'Main Wallet', icon: 'wallet' },
  { value: 'savings', label: 'Savings', icon: 'piggy-bank' },
  { value: 'held', label: 'Held Funds', icon: 'lock' },
];

export default function AddSubscriptionScreen() {
  const navigation = useNavigation<AddSubscriptionNavigationProp>();
  const route = useRoute<AddSubscriptionRouteProp>();
  const currentAccountId = useAuthStore((state) => state.currentAccountId);
  const currentUser = useAuthStore((state) => state.currentUser);
  const themeColors = useThemeColors();

  const isEditMode = route.params?.mode === 'edit';
  const subscriptionId = route.params?.subscriptionId;

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [billingDay, setBillingDay] = useState(1);
  const [selectedVault, setSelectedVault] = useState<VaultType>('main');
  const [isActive, setIsActive] = useState(true);

  const [showBillingDayPicker, setShowBillingDayPicker] = useState(false);
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
        console.error('[AddSubscription] Failed to load categories:', error);
      }
    };

    loadCategories();
  }, [currentUser]);

  // Load subscription data if editing
  useEffect(() => {
    if (isEditMode && subscriptionId) {
      loadSubscription();
    }
  }, []);

  const loadSubscription = async () => {
    if (!subscriptionId) return;

    try {
      const subscriptionRepo = new SubscriptionRepository();
      const categoryRepo = new CategoryRepository();

      const subscription = await subscriptionRepo.findById(subscriptionId);

      if (subscription) {
        setName(subscription.name);
        setAmount(subscription.amount.toString());
        setBillingDay(subscription.billingDay);
        setSelectedVault(subscription.vaultType);
        setIsActive(subscription.isActive);

        const category = await categoryRepo.findById(subscription.categoryId);
        setSelectedCategory(category);
      } else {
        Alert.alert('Error', 'Subscription not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('[AddSubscription] Failed to load subscription:', error);
      Alert.alert('Error', 'Failed to load subscription');
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!currentAccountId) {
      Alert.alert('Error', 'Account not found');
      return;
    }

    // Validate
    const nameError = validateRequired(name, 'Subscription name');
    const amountError = validateRequired(amount, 'Amount');

    if (nameError || amountError) {
      setErrors({
        name: nameError || undefined,
        amount: amountError || undefined
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
      const subscriptionRepo = new SubscriptionRepository();

      if (isEditMode && subscriptionId) {
        // Update existing subscription
        await subscriptionRepo.update(subscriptionId, {
          name: name.trim(),
          amount: amountNum,
          categoryId: selectedCategory.id,
          billingDay,
          vaultType: selectedVault,
          isActive,
        });

        Alert.alert('Success', 'Subscription updated successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // Create new subscription
        await subscriptionRepo.create({
          accountId: currentAccountId,
          name: name.trim(),
          amount: amountNum,
          categoryId: selectedCategory.id,
          billingDay,
          vaultType: selectedVault,
          isActive,
        });

        Alert.alert('Success', 'Subscription created successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      console.error('[AddSubscription] Failed to save subscription:', error);
      Alert.alert('Error', 'Failed to save subscription');
    } finally {
      setLoading(false);
    }
  };

  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };

  const billingDays = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Subscription Name */}
      <Input
        label="Subscription Name"
        placeholder="e.g., Netflix, Spotify, Gym Membership"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setErrors({});
        }}
        error={errors.name}
        leftIcon="repeat"
        autoFocus={!isEditMode}
      />

      {/* Amount */}
      <AmountInput
        label="Monthly Amount"
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setErrors({});
        }}
        error={errors.amount}
      />

      {/* Category */}
      <View style={styles.section}>
        <CategoryPicker
          categories={categories}
          selectedCategory={selectedCategory ?? undefined}
          onSelectCategory={(category: Category) => setSelectedCategory(category)}
          type="expense"
          label="Category"
        />
      </View>

      {/* Billing Day */}
      <View style={styles.section}>
        <Text style={styles.label}>Billing Day</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowBillingDayPicker(!showBillingDayPicker)}
        >
          <Text style={styles.pickerText}>
            {billingDay}
            {getOrdinalSuffix(billingDay)} of every month
          </Text>
          <Icon name="chevron-down" size={24} color={themeColors.textSecondary} />
        </TouchableOpacity>

        {/* Billing Day Grid */}
        {showBillingDayPicker && (
          <View style={styles.dayGrid}>
            {billingDays.map((day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayButton,
                  billingDay === day && styles.dayButtonSelected,
                ]}
                onPress={() => {
                  setBillingDay(day);
                  setShowBillingDayPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.dayText,
                    billingDay === day && styles.dayTextSelected,
                  ]}
                >
                  {day}
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
                    ? colors.primary.main
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

      {/* Active Toggle */}
      <TouchableOpacity
        style={styles.activeToggle}
        onPress={() => setIsActive(!isActive)}
      >
        <View style={styles.activeToggleLeft}>
          <Icon
            name={isActive ? 'check-circle' : 'close-circle'}
            size={24}
            color={isActive ? colors.semantic.success : themeColors.textSecondary}
          />
          <View>
            <Text style={styles.activeToggleTitle}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.activeToggleSubtitle}>
              {isActive
                ? 'Will be charged automatically'
                : 'Paused, will not be charged'}
            </Text>
          </View>
        </View>
        <Icon
          name={isActive ? 'toggle-switch' : 'toggle-switch-off'}
          size={32}
          color={isActive ? colors.primary.main : themeColors.textSecondary}
        />
      </TouchableOpacity>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title={isEditMode ? 'Update Subscription' : 'Create Subscription'}
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
  dayGrid: {
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
  dayButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: themeColors.border,
  },
  dayButtonSelected: {
    backgroundColor: colors.primary.main,
  },
  dayText: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  dayTextSelected: {
    color: '#FFFFFF',
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
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.light + '10',
  },
  vaultText: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  vaultTextSelected: {
    color: colors.primary.main,
  },
  activeToggle: {
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
  activeToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  activeToggleTitle: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  activeToggleSubtitle: {
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
