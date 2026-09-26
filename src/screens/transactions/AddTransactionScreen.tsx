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
import { Category, VaultType, Transaction, TransactionInput, Account } from '../../types/models';
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
import { useAutoCategorize } from '../../hooks/useAutoCategorize';
import { useWallets } from '../../hooks/useWallets';

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

  const editTransactionId = route.params?.transactionId;
  const isEditMode = !!editTransactionId;

  const [type, setType] = useState<'income' | 'expense'>(
    route.params?.type || 'expense'
  );
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(
    route.params?.initialDate ? new Date(route.params.initialDate) : new Date()
  );
  const [vaultType, setVaultType] = useState<VaultType>('main');
  const [originalTransaction, setOriginalTransaction] = useState<Transaction | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(isEditMode);
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
    clear: clearCategorySuggestion,
    resolve: resolveCategorySuggestion,
    suggest: suggestCategoryFn,
  } = useAutoCategorize(type);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [layaStatus, setLayaStatus] = useState<string | null>(null);
  const [layaPendingName, setLayaPendingName] = useState<string | null>(null);
  const { wallets } = useWallets();

  // Keep the selected wallet valid when the wallet list loads/changes
  useEffect(() => {
    if (wallets.length === 0) return;
    if (!wallets.some((w) => w.id === vaultType)) {
      setVaultType(wallets[0].id);
    }
  }, [wallets]);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Load account and set default currency
  useEffect(() => {
    loadAccount();
  }, [currentAccountId]);

  useEffect(() => {
    loadCategories();
  }, [currentAccountId, currentUser]);

  // Load original transaction in edit mode and prefill the form
  useEffect(() => {
    if (isEditMode && editTransactionId) {
      loadOriginalTransaction(editTransactionId);
    }
  }, [editTransactionId, currentAccountId]);

  const loadOriginalTransaction = async (id: string) => {
    setLoadingOriginal(true);
    try {
      const txn = await transactionRepo.findById(id);
      if (!txn) {
        Alert.alert('Error', 'Transaction not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setOriginalTransaction(txn);
      setType(txn.type);
      setAmount(txn.amount.toFixed(3));
      setDescription(txn.description || '');
      setDate(new Date(txn.date));
      setVaultType(txn.vaultType);
      setSelectedCurrency(txn.currency || 'USD');
      if (txn.exchangeRate) setExchangeRate(txn.exchangeRate);
      if (txn.convertedAmount) setConvertedAmount(txn.convertedAmount);

      // Resolve category once categories are available
      const allCategories = currentUser
        ? await categoryRepo.findByUser(currentUser.id)
        : categories;
      const match = allCategories.find((c) => c.id === txn.categoryId);
      if (match) {
        // Transfer legs come in matched pairs across accounts — editing one
        // side alone would unbalance the pair, so block it and point at
        // delete + re-transfer instead
        if (match.name === 'Transfer') {
          Alert.alert(
            'Cannot Edit Transfer',
            'Transfer transactions come in linked pairs. Delete this transfer and create a new one instead.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        setSelectedCategory(match);
      } else {
        // Orphaned category (e.g. deleted): keep form usable, user picks anew
        setSelectedCategory(undefined);
      }
    } catch (error) {
      console.error('[AddTransaction] Failed to load transaction for edit:', error);
      Alert.alert('Error', 'Failed to load transaction', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoadingOriginal(false);
    }
  };

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

  /**
   * LAYA icon tap: suggest a category for the current description.
   * - Existing category -> applied immediately, status shows what + confidence
   * - No match -> category set to Other and a Create button appears below
   * All outcomes (including errors) are shown inline — nothing is silent.
   */
  const handleLayaSuggest = async () => {
    if (!description.trim()) {
      setLayaStatus('Type a description first, then tap ✨.');
      return;
    }
    const numericAmount = parseFloat(amount);
    setLayaStatus(null);
    setLayaPendingName(null);
    try {
      const outcome = await suggestCategoryFn(
        description,
        Number.isFinite(numericAmount) ? numericAmount : undefined,
        categories,
      );
      if (!outcome) {
        setLayaStatus('Laya could not suggest a category. Pick one manually.');
        return;
      }
      if (outcome.kind === 'match' && outcome.choice.categoryId) {
        const match = categories.find((c) => c.id === outcome.choice.categoryId);
        if (match) {
          setSelectedCategory(match);
          setErrors((prev) => ({ ...prev, category: '' }));
          const pct = Math.round(outcome.choice.confidence * 100);
          setLayaStatus(`✓ ${match.name} · ${pct}% · LAYA`);
          clearCategorySuggestion();
          return;
        }
      }
      // No usable match: fall back to Other and offer one-tap creation
      const other = categories.find(
        (c) => c.type === type && c.name.toLowerCase() === 'other'
      );
      if (other) {
        setSelectedCategory(other);
        setErrors((prev) => ({ ...prev, category: '' }));
      }
      const proposed =
        outcome.kind === 'create_new' ? outcome.newCategory.name : outcome.choice.categoryName;
      setLayaPendingName(proposed);
      setLayaStatus(`No match — set to Other. Create “${proposed}”?`);
      clearCategorySuggestion();
    } catch (error: any) {
      console.error('[AddTransaction] Laya suggest failed:', error);
      setLayaStatus(`Laya failed: ${error?.message || 'unknown error'}. Pick manually.`);
    }
  };

  /**
   * One-tap creation of the LAYA-proposed category. Success and failure
   * are both reported explicitly with the real message.
   */
  const handleLayaCreate = async () => {
    if (!categorySuggestion || categorySuggestion.kind !== 'create_new') {
      setLayaStatus('Nothing to create — tap ✨ to get a suggestion first.');
      return;
    }
    if (!currentUser) {
      setLayaStatus('Sign in again to create categories.');
      return;
    }
    setCreatingCategory(true);
    try {
      const created = await resolveCategorySuggestion(categorySuggestion, categories);
      if (created) {
        await loadCategories();
        setSelectedCategory(created);
        setErrors((prev) => ({ ...prev, category: '' }));
        setLayaPendingName(null);
        setLayaStatus(`✓ Created “${created.name}” and selected it.`);
        clearCategorySuggestion();
      } else {
        setLayaStatus('Could not create the category. Try again.');
      }
    } catch (error: any) {
      console.error('[AddTransaction] Laya create failed:', error);
      const message = error?.userMessage || error?.message || 'Failed to create the suggested category';
      setLayaStatus(`Create failed: ${message}`);
      Alert.alert('Create Failed', message);
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

  /**
   * Purpose: Resolve the balance-relevant converted amount for the form state
   * Returns null (after alerting) when conversion fails.
   */
  const resolveConversion = async (
    numAmount: number,
    accountCurrency: string,
    forceFresh = false
  ): Promise<{
    finalConvertedAmount: number;
    finalExchangeRate: number | undefined;
    finalOriginalAmount: number | undefined;
  } | null> => {
    console.log('[AddTransaction] Starting conversion check:');
    console.log('[AddTransaction] Amount:', numAmount);
    console.log('[AddTransaction] Selected currency:', selectedCurrency);
    console.log('[AddTransaction] Account currency:', accountCurrency);

    let finalConvertedAmount = numAmount;
    let finalExchangeRate: number | undefined;
    let finalOriginalAmount: number | undefined;

    if (selectedCurrency !== accountCurrency) {
      console.log('[AddTransaction] Currencies differ - conversion needed');
      // forceFresh guards edit mode: cached rate/amount belong to the
      // ORIGINAL amount and must not be reused after the user changes it
      if (!convertedAmount || !exchangeRate || forceFresh) {
        console.log('[AddTransaction] No conversion data cached - converting now...');
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
          return null;
        }
      } else {
        console.log('[AddTransaction] Using cached conversion data');
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

    return { finalConvertedAmount, finalExchangeRate, finalOriginalAmount };
  };

  /** Reverse a transaction's balance effect (used by delete/edit flows) */
  const reverseBalanceEffect = (
    txnType: 'income' | 'expense',
    txnVault: VaultType,
    balanceAmount: number
  ) => {
    if (txnType === 'income') {
      subtractFromVault(txnVault, balanceAmount);
    } else {
      addToVault(txnVault, balanceAmount);
    }
  };

  /** Apply a transaction's balance effect (used by create/edit flows) */
  const applyBalanceEffect = (
    txnType: 'income' | 'expense',
    txnVault: VaultType,
    balanceAmount: number
  ) => {
    if (txnType === 'income') {
      addToVault(txnVault, balanceAmount);
    } else {
      subtractFromVault(txnVault, balanceAmount);
    }
  };

  /**
   * Purpose: Update an existing transaction and correct the wallet balance
   * by reversing the old effect first, then applying the new one. This stays
   * correct when type, wallet or amount all change at once.
   */
  const handleUpdate = async (
    original: Transaction,
    numAmount: number,
    finalConvertedAmount: number,
    finalExchangeRate: number | undefined,
    finalOriginalAmount: number | undefined
  ) => {
    try {
      // Reverse the original balance effect
      const oldBalanceAmount = original.convertedAmount || original.amount;
      reverseBalanceEffect(original.type, original.vaultType, oldBalanceAmount);

      // Persist the updated fields
      await transactionRepo.update(original.id, {
        type,
        amount: numAmount,
        categoryId: selectedCategory!.id,
        description,
        date: date.getTime(),
        vaultType,
        currency: selectedCurrency,
        originalAmount: finalOriginalAmount,
        exchangeRate: finalExchangeRate,
        convertedAmount: finalConvertedAmount !== numAmount ? finalConvertedAmount : undefined,
      } as Partial<Transaction>);

      // Append any newly attached receipt images (offset keeps filenames unique)
      const existingImages = await transactionRepo.getImages(original.id);
      for (let i = 0; i < selectedImageUris.length; i++) {
        try {
          const { originalPath } = await compressAndSaveImage(
            selectedImageUris[i],
            `${original.id}_${existingImages.length + i}`
          );
          await transactionRepo.addImage(original.id, originalPath, existingImages.length + i);
        } catch (error) {
          console.error('[AddTransaction] Failed to save image:', error);
        }
      }

      // Apply the new balance effect
      applyBalanceEffect(type, vaultType, finalConvertedAmount);

      Alert.alert(
        'Success',
        `${type === 'income' ? 'Income' : 'Expense'} updated successfully`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('[AddTransaction] Error updating transaction:', error);
      Alert.alert('Error', 'Failed to update transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!currentAccountId || !currentAccount) {
      Alert.alert('Error', 'No account selected');
      return;
    }
    // In edit mode the original must be loaded first — otherwise the save
    // would fall through and create a duplicate transaction
    if (isEditMode && !originalTransaction) {
      Alert.alert('Please wait', 'Still loading the transaction to edit.');
      return;
    }

    setLoading(true);

    try {
      const numAmount = parseFloat(amount);
      const accountCurrency = currentAccount.currency;

      // In edit mode the cached conversion belongs to the original amount:
      // re-convert live whenever amount or currency changed since loading
      const conversionStale =
        isEditMode &&
        !!originalTransaction &&
        (numAmount !== originalTransaction.amount ||
          selectedCurrency !== originalTransaction.currency);
      const conversion = await resolveConversion(numAmount, accountCurrency, conversionStale);
      if (!conversion) {
        setLoading(false);
        return;
      }
      const { finalConvertedAmount, finalExchangeRate, finalOriginalAmount } = conversion;

      // Edit mode: update existing transaction + correct the balance
      if (isEditMode && originalTransaction) {
        await handleUpdate(
          originalTransaction,
          numAmount,
          finalConvertedAmount,
          finalExchangeRate,
          finalOriginalAmount
        );
        return;
      }

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

      applyBalanceEffect(type, vaultType, balanceAmount);

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
          <Text style={styles.sectionTitle}>Type</Text>
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
                setLayaStatus(null);
                setLayaPendingName(null);
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
                setLayaStatus(null);
                setLayaPendingName(null);
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
          <Text style={styles.sectionTitle}>Amount</Text>
          <AmountInput
            value={amount}
            onChangeText={setAmount}
            label=""
            error={errors.amount}
            enableCalculator={true}
          />

          {/* Description Input */}
          <Text style={styles.sectionTitle}>Description</Text>
          <Input
            label=""
            value={description}
            onChangeText={setDescription}
            placeholder="Add a note... (optional)"
            multiline
            numberOfLines={3}
          />

          {/* Category Picker with LAYA icon */}
          <View style={styles.categoryLabelRow}>
            <Text style={styles.sectionTitle}>Category</Text>
            <TouchableOpacity
              style={styles.layaIconButton}
              onPress={handleLayaSuggest}
              disabled={suggestLoading || creatingCategory}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Auto-categorize with Laya"
            >
              {suggestLoading ? (
                <Icon name="loading" size={20} color={themeColors.primary} />
              ) : (
                <Icon name="sparkles" size={20} color={themeColors.primary} />
              )}
            </TouchableOpacity>
          </View>
          <CategoryPicker
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={(c) => {
              setSelectedCategory(c);
              setLayaPendingName(null);
            }}
            type={type}
            label=""
            error={errors.category}
          />
          {layaStatus ? <Text style={styles.layaStatus}>{layaStatus}</Text> : null}
          {layaPendingName ? (
            <TouchableOpacity
              style={[styles.createCategoryButton, creatingCategory && styles.buttonDisabled]}
              onPress={handleLayaCreate}
              disabled={creatingCategory}
              activeOpacity={0.8}
            >
              <Icon name="plus" size={18} color="#FFF" />
              <Text style={styles.createCategoryText}>
                {creatingCategory ? 'Creating…' : `Create “${layaPendingName}”`}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Currency Picker */}
          <Text style={styles.sectionTitle}>Currency</Text>
          <CurrencyPicker
            selectedCurrency={selectedCurrency}
            onSelectCurrency={setSelectedCurrency}
            label=""
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
            <Text style={styles.sectionTitle}>Wallet</Text>
            <View style={styles.vaultOptions}>
              {wallets.map((wallet) => (
                <TouchableOpacity
                  key={wallet.id}
                  style={[
                    styles.vaultButton,
                    styles.vaultButtonGrid,
                    vaultType === wallet.id && styles.vaultButtonActive,
                  ]}
                  onPress={() => setVaultType(wallet.id)}
                >
                  <Text
                    style={[
                      styles.vaultButtonText,
                      vaultType === wallet.id && styles.vaultButtonTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {wallet.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date Picker */}
          <Text style={styles.sectionTitle}>Date</Text>
          <DatePicker
            value={date}
            onChange={setDate}
            label=""
            maximumDate={new Date()}
          />

          {/* Image Picker */}
          <Text style={styles.sectionTitle}>Receipts</Text>
          <ImagePickerButton
            onImagesChanged={setSelectedImageUris}
            selectedImageUris={selectedImageUris}
            disabled={loading}
          />

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && selectedCategory && (
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Type</Text>
                <Text style={styles.summaryValue}>{type === 'income' ? 'Income' : 'Expense'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Category</Text>
                <Text style={styles.summaryValue}>{selectedCategory.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Wallet</Text>
                <Text style={styles.summaryValue}>{wallets.find((w) => w.id === vaultType)?.name ?? vaultType}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryAmount}>
                  {parseFloat(amount).toFixed(3)} {selectedCurrency}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title={isEditMode ? `Update ${type === 'income' ? 'Income' : 'Expense'}` : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
          onPress={handleSave}
          loading={loading || loadingOriginal}
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
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  summary: {
    backgroundColor: themeColors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    ...typography.body,
    color: themeColors.textSecondary,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  summaryAmount: {
    ...typography.body,
    fontWeight: '700',
    color: themeColors.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: themeColors.border,
    marginVertical: spacing.sm,
  },
  vaultOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  vaultButtonGrid: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: spacing.sm,
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
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  layaIconButton: {
    padding: spacing.xs,
    borderRadius: 8,
  },
  layaStatus: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  createCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: themeColors.primary,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  createCategoryText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
