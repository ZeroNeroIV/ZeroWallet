// Create Account Screen
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Input } from '../../components/forms/Input';
import { Button } from '../../components/forms/Button';
import { CurrencyPicker } from '../../components/forms/CurrencyPicker';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { validateRequired } from '../../utils/validators';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

type CreateAccountNavigationProp = StackNavigationProp<
  MainStackParamList,
  'CreateAccount'
>;

// Available account icons
const ACCOUNT_ICONS = [
  'wallet',
  'credit-card',
  'bank',
  'cash',
  'piggy-bank',
  'currency-usd',
];

// Available colors
const ACCOUNT_COLORS = [
  '#4ECDC4',
  '#FFE66D',
  '#FF6B6B',
  '#A8E6CF',
  '#FF8B94',
  '#B4A7D6',
  '#89CFF0',
  '#06D6A0',
];

export default function CreateAccountScreen() {
  const navigation = useNavigation<CreateAccountNavigationProp>();
  const currentUser = useAuthStore((state) => state.currentUser);
  const initializeBalance = useAccountStore((state) => state.initializeBalance);
  const themeColors = useThemeColors();

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('wallet');
  const [selectedColor, setSelectedColor] = useState('#4ECDC4');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleCreateAccount = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'User not found');
      return;
    }

    // Validate
    const nameError = validateRequired(name, 'Account name');
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const accountRepo = new AccountRepository();

      // Create account
      const newAccount = await accountRepo.create({
        userId: currentUser.id,
        name: name.trim(),
        currency: selectedCurrency,
        icon: selectedIcon,
        color: selectedColor,
        isDefault: false,
      });

      // Initialize balance in MMKV
      initializeBalance(newAccount.id);

      Alert.alert('Success', 'Account created successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('[CreateAccount] Failed to create account:', error);
      Alert.alert('Error', 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input
        label="Account Name"
        placeholder="e.g., My Savings, Business Account"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setErrors({});
        }}
        error={errors.name}
        leftIcon="wallet-outline"
        autoFocus
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose Icon</Text>
        <View style={styles.iconGrid}>
          {ACCOUNT_ICONS.map((icon) => (
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
                size={32}
                color={selectedIcon === icon ? selectedColor : themeColors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose Color</Text>
        <View style={styles.colorGrid}>
          {ACCOUNT_COLORS.map((color) => (
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

      <View style={styles.preview}>
        <Text style={styles.previewLabel}>Preview</Text>
        <View style={styles.previewCard}>
          <View
            style={[
              styles.previewIcon,
              { backgroundColor: selectedColor + '20' },
            ]}
          >
            <Icon name={selectedIcon} size={32} color={selectedColor} />
          </View>
          <View style={styles.previewInfo}>
            <Text style={styles.previewName}>{name || 'Account Name'}</Text>
            <Text style={styles.previewCurrency}>{selectedCurrency}</Text>
          </View>
        </View>
      </View>

      {/* Currency Selection */}
      <View style={styles.section}>
        <CurrencyPicker
          selectedCurrency={selectedCurrency}
          onSelectCurrency={setSelectedCurrency}
          label="Account Currency"
        />
      </View>

      <View style={styles.footer}>
        <Button
          title="Create Account"
          onPress={handleCreateAccount}
          loading={loading}
          disabled={loading || !name.trim()}
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
    padding: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
    color: themeColors.text,
    marginBottom: spacing.md,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  iconOption: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: themeColors.surface,
    borderWidth: 2,
    borderColor: themeColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconOptionSelected: {
    borderWidth: 3,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: themeColors.surface,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  preview: {
    marginTop: spacing.xl,
  },
  previewLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
    color: themeColors.text,
    marginBottom: spacing.md,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  previewIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold,
    color: themeColors.text,
    marginBottom: spacing.xs,
  },
  previewCurrency: {
    fontSize: typography.fontSize.sm,
    color: themeColors.textSecondary,
  },
  footer: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
});
