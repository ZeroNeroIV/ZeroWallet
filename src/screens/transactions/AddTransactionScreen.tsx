import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { v4 as uuidv4 } from 'uuid';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AmountInput } from '../../components/forms/AmountInput';
import { CategoryPicker } from '../../components/forms/CategoryPicker';
import { CurrencyPicker } from '../../components/forms/CurrencyPicker';
import { DatePicker } from '../../components/forms/DatePicker';
import { Input } from '../../components/forms/Input';
import { Button } from '../../components/forms/Button';
import { CurrencyConversionModal } from '../../components/transactions/CurrencyConversionModal';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { MainStackParamList } from '../../types/navigation';
import { Category, VaultType, TransactionInput, Account } from '../../types/models';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { ImagePickerButton } from '../../components/forms/ImagePickerButton';
import { compressAndSaveImage, deleteTransactionImage } from '../../utils/imageStorage';
import { convertCurrency } from '../../services/currencyService';
import { formatCurrency } from '../../constants/currencies';
import { CategorySuggestionBanner } from '../../components/transactions/CategorySuggestionBanner';
import { useAutoCategorize } from '../../hooks/useAutoCategorize';

type AddTransactionScreenNavigationProp = StackNavigationProp<
  MainStackParamList,
  'AddTransaction'
>;

type AddTransactionScreenRouteProp = RouteProp<
  MainStackParamList,
  'AddTransaction'
>;

export const AddTransactionScreen: React.FC = () => {
  const navigation = useNavigation<AddTransactionScreenNavigationProp>();
  const route = useRoute<AddTransactionScreenRouteProp>();

  const { currentAccountId, currentUser } = useAuthStore();
  const { addToVault, subtractFromVault } = useVaultStore();
  const themeColors = useThemeColors();

  const [type, setType] = useState<'income' | 'expense'>(
    route.params?.type || 'expense'
  );
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [vaultType, setVaultType] = useState<VaultType>('main');
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    amount: '',
    category: '',
  });

  // Currency state
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [conversionModalVisible, setConversionModalVisible] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | undefined>();
  const [convertedAmount, setConvertedAmount] = useState<number | undefined>();

  const categoryRepo = new CategoryRepository();
  const transactionRepo = new TransactionRepository();
  const accountRepo = new AccountRepository();

  const {
    suggestion: categorySuggestion,
    loading: suggestLoading,
    error: suggestError,
    clear: clearCategorySuggestion,
    resolve: resolveCategorySuggestion,
    suggestAndAutoApply: suggestAndAutoApplyCategory,
  } = useAutoCategorize(type);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Load account and set default currency
  useEffect(() => {
    loadAccount();
  }, [currentAccountId]);

  useEffect(() => {
    loadCategories();
  }, [currentAccountId, currentUser]);

  useEffect(() => {
    console.log('[AddTransaction] Type changed to:', type);
    console.log('[AddTransaction] Available categories for type:', categories.filter(c => c.type === type).map(c => c.name));
  }, [type, categories]);

  const loadAccount = async () => {
    if (!currentAccountId) return;

    try {
      const account = await accountRepo.findById(currentAccountId);
      if (account) {
        setCurrentAccount(account);
        setSelectedCurrency(account.currency);
        console.log('[AddTransaction] Loaded account currency:', account.currency);
      }
    } catch (error) {
      console.error('[AddTransaction] Error loading account:', error);
    }
  };

  const loadCategories = async () => {
    if (!currentAccountId || !currentUser) return;

    try {
      const allCategories = await categoryRepo.findByUser(currentUser.id);
      console.log('[AddTransaction] Total categories loaded:', allCategories.length);

      // If no categories exist, create default ones
      if (allCategories.length === 0) {
        console.log('[AddTransaction] No categories found, creating defaults for user:', currentUser.id);
        const { createDefaultCategories } = await import(
          '../../database/repositories/CategoryRepository'
        );
        await createDefaultCategories(currentUser.id);

        // Reload categories after creating defaults
        const reloadedCategories = await categoryRepo.findByUser(currentUser.id);
        console.log('[AddTransaction] Default categories created:', reloadedCategories.length);
        console.log('[AddTransaction] All categories:', reloadedCategories.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color
        })));
        setCategories(reloadedCategories);
        return;
      }

      console.log('[AddTransaction] All categories:', allCategories.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color
      })));
      console.log('[AddTransaction] Categories by type:', {
        income: allCategories.filter(c => c.type === 'income').length,
        expense: allCategories.filter(c => c.type === 'expense').length,
      });
      setCategories(allCategories);
    } catch (error) {
      console.error('[AddTransaction] Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    }
  };

  const handleConversionComplete = (result: {
    amount: number;
    convertedAmount: number;
    exchangeRate: number;
  }) => {
    setAmount(result.amount.toString());
    setConvertedAmount(result.convertedAmount);
    setExchangeRate(result.exchangeRate);
    console.log('[AddTransaction] Conversion complete:', result);
  };

  const handleAutoCategorize = async () => {
    if (!description.trim()) {
      Alert.alert('Add a description', 'Type a description first so Laya can suggest a category.');
      return;
    }
    const numericAmount = parseFloat(amount);
    setCreatingCategory(true);
    try {
      // Autonomous: LAYA suggests, and creates the category on demand
      // when the suggestion doesn't exist yet
      const result = await suggestAndAutoApplyCategory(
        description,
        Number.isFinite(numericAmount) ? numericAmount : undefined,
        categories,
        async () => {
          await loadCategories();
        },
      );
      if (result.createdNew && result.category) {
        setSelectedCategory(result.category);
        setErrors((prev) => ({ ...prev, category: '' }));
        clearCategorySuggestion();
        Alert.alert('Category created', `Laya created "${result.category.name}" and selected it.`);
      }
      // Existing-category matches stay visible in the banner for one-tap Apply
    } catch (error) {
      console.error('[AddTransaction] Laya auto-categorize failed:', error);
      Alert.alert('Error', 'Laya could not categorize this transaction');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleApplySuggestedMatch = (categoryId: string) => {
    const match = categories.find((c) => c.id === categoryId);
    if (match) {
      setSelectedCategory(match);
      setErrors((prev) => ({ ...prev, category: '' }));
    }
    clearCategorySuggestion();
  };

  const handleCreateSuggestedCategory = async () => {
    if (!categorySuggestion || categorySuggestion.kind !== 'create_new') return;
    setCreatingCategory(true);
    try {
      const created = await resolveCategorySuggestion(categorySuggestion, categories);
      if (created) {
        await loadCategories();
        setSelectedCategory(created);
        setErrors((prev) => ({ ...prev, category: '' }));
        clearCategorySuggestion();
        Alert.alert('Category created', `"${created.name}" was created and selected.`);
      }
    } catch (error) {
      console.error('[AddTransaction] Failed to create suggested category:', error);
      Alert.alert('Error', 'Failed to create the suggested category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const validate = () => {
    const newErrors = {
      amount: '',
      category: '',
    };

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (!selectedCategory) {
      newErrors.category = 'Please select a category';
    }

    setErrors(newErrors);
    return !newErrors.amount && !newErrors.category;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!currentAccountId || !currentAccount) {
      Alert.alert('Error', 'No account selected');
      return;
    }

    setLoading(true);

    try {
      // Generate transaction ID first (needed for image storage)
      const transactionId = uuidv4();
      const savedImagePaths: string[] = [];

      // Save all selected images
      for (let i = 0; i < selectedImageUris.length; i++) {
        try {
          const { originalPath } = await compressAndSaveImage(
            selectedImageUris[i],
            `${transactionId}_${i}`
          );
          savedImagePaths.push(originalPath);
        } catch (error) {
          console.error('[AddTransaction] Failed to save image:', error);
        }
      }

      const imagePath = savedImagePaths[0];

      const numAmount = parseFloat(amount);
      const accountCurrency = currentAccount.currency;

      console.log('[AddTransaction] Starting conversion check:');
      console.log('[AddTransaction] Amount:', numAmount);
      console.log('[AddTransaction] Selected currency:', selectedCurrency);
      console.log('[AddTransaction] Account currency:', accountCurrency);

      // Handle currency conversion
      let finalConvertedAmount = numAmount;
      let finalExchangeRate: number | undefined;
      let finalOriginalAmount: number | undefined;

      if (selectedCurrency !== accountCurrency) {
        console.log('[AddTransaction] Currencies differ - conversion needed');
        // Different currency - need to convert
        if (!convertedAmount || !exchangeRate) {
          console.log('[AddTransaction] No conversion data cached - converting now...');
          // No conversion data yet, convert now
          try {
            const conversion = await convertCurrency(
              numAmount,
              selectedCurrency,
              accountCurrency
            );
            finalConvertedAmount = conversion.convertedAmount;
            finalExchangeRate = conversion.exchangeRate;
            finalOriginalAmount = numAmount;
            console.log('[AddTransaction] Auto-converted:', {
              from: `${numAmount} ${selectedCurrency}`,
              to: `${finalConvertedAmount} ${accountCurrency}`,
              rate: finalExchangeRate
            });
          } catch (error) {
            console.error('[AddTransaction] Conversion failed:', error);
            Alert.alert(
              'Error',
              'Failed to convert currency. Please check your internet connection.'
            );
            setLoading(false);
            return;
          }
        } else {
          console.log('[AddTransaction] Using cached conversion data');
          // Use existing conversion data
          finalConvertedAmount = convertedAmount;
          finalExchangeRate = exchangeRate;
          finalOriginalAmount = numAmount;
          console.log('[AddTransaction] Cached conversion:', {
            from: `${numAmount} ${selectedCurrency}`,
            to: `${finalConvertedAmount} ${accountCurrency}`,
            rate: finalExchangeRate
          });
        }
      } else {
        console.log('[AddTransaction] Same currency - no conversion needed');
      }

      console.log('[AddTransaction] Final amounts:', {
        originalAmount: finalOriginalAmount,
        convertedAmount: finalConvertedAmount,
        balanceUpdateAmount: finalConvertedAmount
      });

      const transactionData: TransactionInput = {
        accountId: currentAccountId,
        type,
        amount: numAmount,
        categoryId: selectedCategory!.id,
        description,
        date: date.getTime(),
        vaultType,
        isRecurring: false,
        imagePath,
        currency: selectedCurrency,
        originalAmount: finalOriginalAmount,
        exchangeRate: finalExchangeRate,
        convertedAmount: finalConvertedAmount !== numAmount ? finalConvertedAmount : undefined,
      };

      // Create transaction in SQLite
      const transaction = await transactionRepo.create(transactionData);
      // Save all images to transaction_images table
      for (let i = 0; i < savedImagePaths.length; i++) {
        await transactionRepo.addImage(transaction.id, savedImagePaths[i], i);
      }
      console.log('[AddTransaction] Transaction created in database');

      // Log balance before update
      const { useAccountStore } = await import('../../store/accountStore');
      const beforeBalance = useAccountStore.getState().balances[currentAccountId];
      console.log('[AddTransaction] Balance before update:', beforeBalance);

      // Update vault balance in MMKV (use converted amount for balance)
      // CRITICAL: Use converted amount if currency differs, otherwise use original amount
      const balanceAmount = finalConvertedAmount;
      console.log(`[AddTransaction] Updating ${vaultType} vault: ${type === 'income' ? 'Adding' : 'Subtracting'} ${balanceAmount} ${currentAccount.currency}`);
      console.log(`[AddTransaction] Balance update - Using amount: ${balanceAmount}`);

      if (type === 'income') {
        addToVault(vaultType, balanceAmount);
      } else {
        subtractFromVault(vaultType, balanceAmount);
      }

      // Log balance after update
      const afterBalance = useAccountStore.getState().balances[currentAccountId];
      console.log('[AddTransaction] Balance after update:', afterBalance);

      Alert.alert(
        'Success',
        `${type === 'income' ? 'Income' : 'Expense'} added successfully`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('[AddTransaction] Error saving transaction:', error);
      Alert.alert('Error', 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Type Toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'expense' && styles.typeButtonActive,
              ]}
              onPress={() => {
                setType('expense');
                setSelectedCategory(undefined);
                clearCategorySuggestion();
              }}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'expense' && styles.typeButtonTextActive,
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'income' && styles.typeButtonActive,
              ]}
              onPress={() => {
                setType('income');
                setSelectedCategory(undefined);
                clearCategorySuggestion();
              }}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'income' && styles.typeButtonTextActive,
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <AmountInput
            value={amount}
            onChangeText={setAmount}
            label="Amount"
            error={errors.amount}
            enableCalculator={true}
          />

          {/* Description Input */}
          <Input
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Add a note..."
            multiline
            numberOfLines={3}
          />

          {/* Category Picker */}
          <CategoryPicker
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            type={type}
            label="Category"
            error={errors.category}
          />

          {/* Laya auto-categorize */}
          <TouchableOpacity
            style={styles.suggestButton}
            onPress={handleAutoCategorize}
            disabled={suggestLoading || creatingCategory}
            activeOpacity={0.8}
          >
            <Icon name="sparkles" size={18} color={themeColors.primary} />
            <Text style={styles.suggestButtonText}>
              {suggestLoading ? 'Laya is thinking…' : 'Auto-categorize with Laya'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.suggestHint}>
            Powered by LAYA · works offline, no setup needed.
          </Text>
          {suggestError ? <Text style={styles.suggestError}>{suggestError}</Text> : null}
          {categorySuggestion || suggestLoading ? (
            <CategorySuggestionBanner
              suggestion={categorySuggestion}
              loading={suggestLoading}
              creating={creatingCategory}
              onApplyMatch={handleApplySuggestedMatch}
              onCreateNew={handleCreateSuggestedCategory}
              onDismiss={clearCategorySuggestion}
            />
          ) : null}

          {/* Currency Picker */}
          <CurrencyPicker
            selectedCurrency={selectedCurrency}
            onSelectCurrency={setSelectedCurrency}
            label="Currency"
          />

          {/* Currency Conversion Info & Button */}
          {currentAccount && selectedCurrency !== currentAccount.currency && (
            <View style={styles.conversionInfo}>
              <TouchableOpacity
                style={styles.conversionButton}
                onPress={() => setConversionModalVisible(true)}
              >
                <Icon name="swap-horizontal" size={20} color={themeColors.primary} />
                <Text style={styles.conversionButtonText}>
                  Convert {selectedCurrency} → {currentAccount.currency}
                </Text>
              </TouchableOpacity>
              {convertedAmount && exchangeRate && (
                <Text style={styles.conversionText}>
                  {formatCurrency(parseFloat(amount) || 0, selectedCurrency)} ≈{' '}
                  {formatCurrency(convertedAmount, currentAccount.currency)}
                </Text>
              )}
            </View>
          )}

          {/* Wallet Picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Wallet</Text>
            <View style={styles.vaultOptions}>
              <TouchableOpacity
                style={[
                  styles.vaultButton,
                  vaultType === 'main' && styles.vaultButtonActive,
                ]}
                onPress={() => setVaultType('main')}
              >
                <Text
                  style={[
                    styles.vaultButtonText,
                    vaultType === 'main' && styles.vaultButtonTextActive,
                  ]}
                >
                  Investment
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.vaultButton,
                  vaultType === 'savings' && styles.vaultButtonActive,
                ]}
                onPress={() => setVaultType('savings')}
              >
                <Text
                  style={[
                    styles.vaultButtonText,
                    vaultType === 'savings' && styles.vaultButtonTextActive,
                  ]}
                >
                  Savings
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.vaultButton,
                  vaultType === 'held' && styles.vaultButtonActive,
                ]}
                onPress={() => setVaultType('held')}
              >
                <Text
                  style={[
                    styles.vaultButtonText,
                    vaultType === 'held' && styles.vaultButtonTextActive,
                  ]}
                >
                  Recurring
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Picker */}
          <DatePicker
            value={date}
            onChange={setDate}
            label="Date"
            maximumDate={new Date()}
          />

          {/* Image Picker */}
          <ImagePickerButton
            onImagesChanged={setSelectedImageUris}
            selectedImageUris={selectedImageUris}
            disabled={loading}
          />
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title={`Add ${type === 'income' ? 'Income' : 'Expense'}`}
          onPress={handleSave}
          loading={loading}
        />
      </View>

      {/* Currency Conversion Modal */}
      {currentAccount && (
        <CurrencyConversionModal
          visible={conversionModalVisible}
          onClose={() => setConversionModalVisible(false)}
          fromCurrency={selectedCurrency}
          toCurrency={currentAccount.currency}
          initialAmount={parseFloat(amount) || 0}
          onConversionComplete={handleConversionComplete}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: themeColors.border,
    borderRadius: 12,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: themeColors.surface,
  },
  typeButtonText: {
    ...typography.body,
    color: themeColors.textSecondary,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: themeColors.primary,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '500',
    color: themeColors.textSecondary,
    marginBottom: spacing.xs,
  },
  vaultOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  vaultButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: themeColors.surface,
    borderWidth: 1,
    borderColor: themeColors.border,
    alignItems: 'center',
  },
  vaultButtonActive: {
    backgroundColor: themeColors.primary + '15',
    borderColor: themeColors.primary,
  },
  vaultButtonText: {
    ...typography.body,
    color: themeColors.textSecondary,
    fontWeight: '600',
  },
  vaultButtonTextActive: {
    color: themeColors.primary,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: themeColors.surface,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
  conversionInfo: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: themeColors.primary + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: themeColors.primary + '30',
  },
  conversionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  conversionButtonText: {
    ...typography.body,
    color: themeColors.primary,
    fontWeight: '600',
  },
  conversionText: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: themeColors.primary + '40',
    backgroundColor: themeColors.primary + '10',
    marginBottom: spacing.xs,
  },
  suggestButtonText: {
    ...typography.body,
    color: themeColors.primary,
    fontWeight: '700',
  },
  suggestHint: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginBottom: spacing.sm,
  },
  suggestError: {
    ...typography.caption,
    color: '#EF4444',
    marginBottom: spacing.sm,
  },
});
