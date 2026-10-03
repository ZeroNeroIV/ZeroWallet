// Simplizum Log & Edit Transaction — Swift Minimalist Flow with Tabular Figures & Category Grid
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { MainStackParamList } from '../../types/navigation';
import type { Category, Transaction, Wallet, VaultType } from '../../types/models';
import { useAuthStore } from '../../store/authStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { transferBetweenWallets, syncBalancesFromDatabase } from '../../services/walletTransferService';
import { convertCurrency } from '../../services/currencyService';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import { ImagePickerButton } from '../../components/forms/ImagePickerButton';
import { compressAndSaveImage } from '../../utils/imageStorage';
import { useAutoCategorize } from '../../hooks/useAutoCategorize';
import { createProposedCategory } from '../../services/ai/categorizationService';
import { CATEGORIZATION_DEFAULTS, type NewCategoryProposal } from '../../types/categorization';

type NavProp = StackNavigationProp<MainStackParamList, 'AddTransaction'>;
type RouteProps = RouteProp<MainStackParamList, 'AddTransaction'>;

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'JOD', 'SAR', 'AED', 'EGP'];

export const AddTransactionScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { currentAccountId, currentUser } = useAuthStore();
  const themeColors = useThemeColors();

  const editTransactionId = route.params?.transactionId;
  const isEditMode = !!editTransactionId;

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    (route.params?.type as 'expense' | 'income' | 'transfer') || 'expense'
  );
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [fromWalletId, setFromWalletId] = useState<string>(route.params?.fromWalletId || '');
  const [toWalletId, setToWalletId] = useState<string>(route.params?.toWalletId || '');
  const [derivedBalances, setDerivedBalances] = useState<Record<string, number>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [date, setDate] = useState<number>(Date.now());
  const [currency, setCurrency] = useState('USD');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [convertedAmount, setConvertedAmount] = useState<number | undefined>();
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Entities
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [walletPickerTarget, setWalletPickerTarget] = useState<'single' | 'from' | 'to' | null>(null);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

  // Laya auto-categorization (debounced on description)
  const categoryType: 'income' | 'expense' = type === 'income' ? 'income' : 'expense';
  const { suggest: suggestCategory, loading: categorizing } = useAutoCategorize(categoryType);
  const [categoryProposal, setCategoryProposal] = useState<NewCategoryProposal | null>(null);
  const [addingProposal, setAddingProposal] = useState(false);
  const manualCategoryRef = useRef(false);
  const categoriesRef = useRef<Category[]>([]);
  categoriesRef.current = categories;

  useEffect(() => {
    if (type === 'transfer' || isEditMode) return undefined;
    const text = description.trim();
    if (text.length < 3) {
      setCategoryProposal(null);
      manualCategoryRef.current = false;
      return undefined;
    }
    const timer = setTimeout(async () => {
      const pool = categoriesRef.current.filter((c) => c.type === categoryType);
      if (pool.length === 0) return;
      const outcome = await suggestCategory(text, undefined, pool);
      if (!outcome) return;

      const confident = outcome.choice.confidence >= CATEGORIZATION_DEFAULTS.SUGGEST_THRESHOLD;
      if (outcome.kind === 'match' && confident && outcome.choice.categoryId) {
        setCategoryProposal(null);
        if (!manualCategoryRef.current) setSelectedCategoryId(outcome.choice.categoryId);
        return;
      }

      const other = pool.find((c) => c.name.toLowerCase() === 'other');
      if (other && !manualCategoryRef.current) setSelectedCategoryId(other.id);
      setCategoryProposal(outcome.kind === 'create_new' ? outcome.newCategory : null);
    }, 600);
    return () => clearTimeout(timer);
  }, [description, type, categoryType, isEditMode, suggestCategory]);

  useEffect(() => {
    setCategoryProposal(null);
  }, [type]);

  const handleAddProposedCategory = async () => {
    if (!categoryProposal || !currentUser) return;
    try {
      setAddingProposal(true);
      triggerHaptic('selection');
      const created = await createProposedCategory(currentUser.id, categoryType, categoryProposal);
      setCategories((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
      manualCategoryRef.current = true;
      setSelectedCategoryId(created.id);
      setCategoryProposal(null);
      triggerHaptic('notificationSuccess');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add category.');
    } finally {
      setAddingProposal(false);
    }
  };

  // Load initial data & edit record if present
  useEffect(() => {
    const init = async () => {
      if (!currentAccountId || !currentUser) return;
      try {
        setLoading(true);
        const accRepo = new AccountRepository();
        const walletRepo = new WalletRepository();
        const catRepo = new CategoryRepository();
        const txRepo = new TransactionRepository();

        const [acc, wList, cList, balances] = await Promise.all([
          accRepo.findById(currentAccountId),
          walletRepo.findByAccount(currentAccountId),
          catRepo.findByUser(currentUser.id),
          walletRepo.getDerivedBalances(currentAccountId),
        ]);

        const accCur = acc?.currency || 'USD';
        setBaseCurrency(accCur);
        setCurrency(accCur);
        setWallets(wList);
        setCategories(cList);
        setDerivedBalances(balances);

        // Preselect default wallet
        const defaultWallet = wList.find((w) => w.isDefault) || wList[0];
        if (defaultWallet) {
          setSelectedWalletId(defaultWallet.id);
          const initialFrom = route.params?.fromWalletId || defaultWallet.id;
          const initialTo =
            route.params?.toWalletId ||
            wList.find((w) => w.id !== initialFrom)?.id ||
            initialFrom;
          setFromWalletId(initialFrom);
          setToWalletId(initialTo);
        }

        // If editing existing transaction
        if (editTransactionId) {
          const txn = await txRepo.findById(editTransactionId);
          if (txn) {
            setType(txn.type === 'income' ? 'income' : 'expense');
            setAmount(String(txn.originalAmount ?? txn.amount));
            setDescription(txn.description || '');
            setSelectedWalletId(txn.walletId || txn.vaultType || defaultWallet?.id || '');
            setSelectedCategoryId(txn.categoryId);
            setDate(txn.date);
            setCurrency(txn.currency || accCur);
            if (txn.exchangeRate) setExchangeRate(txn.exchangeRate);
            if (txn.convertedAmount) setConvertedAmount(txn.convertedAmount);
            if (txn.images) setSelectedImageUris(txn.images);
            else if (txn.imagePath) setSelectedImageUris([txn.imagePath]);
          }
        } else if (route.params?.type) {
          setType(route.params.type);
        }
      } catch (err) {
        console.warn('[AddTransactionScreen] init error:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [currentAccountId, currentUser, editTransactionId, route.params]);

  // Recalculate currency conversion when amount or currency changes
  useEffect(() => {
    const computeConversion = async () => {
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0 || currency === baseCurrency) {
        setConvertedAmount(undefined);
        setExchangeRate(1);
        return;
      }
      try {
        const res = await convertCurrency(num, currency, baseCurrency);
        setConvertedAmount(res.convertedAmount);
        setExchangeRate(res.exchangeRate);
      } catch {
        setConvertedAmount(undefined);
      }
    };
    computeConversion();
  }, [amount, currency, baseCurrency]);

  // Categories filtered by active type
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  // Preselect first category of that type if none selected or mismatched
  useEffect(() => {
    const currentCat = categories.find((c) => c.id === selectedCategoryId);
    if (!currentCat || currentCat.type !== type) {
      const fallback = filteredCategories[0];
      if (fallback) setSelectedCategoryId(fallback.id);
    }
  }, [type, filteredCategories, categories, selectedCategoryId]);

  const selectedWallet = useMemo(() => {
    return wallets.find((w) => w.id === selectedWalletId);
  }, [wallets, selectedWalletId]);

  const fromWallet = useMemo(() => {
    return wallets.find((w) => w.id === fromWalletId);
  }, [wallets, fromWalletId]);

  const toWallet = useMemo(() => {
    return wallets.find((w) => w.id === toWalletId);
  }, [wallets, toWalletId]);

  const fromBalance = (fromWalletId ? derivedBalances[fromWalletId] : 0) ?? 0;
  const toBalance = (toWalletId ? derivedBalances[toWalletId] : 0) ?? 0;

  const handleSwapWallets = () => {
    triggerHaptic('impactLight');
    const prev = fromWalletId;
    setFromWalletId(toWalletId);
    setToWalletId(prev);
  };

  const handleQuickPercent = (percent: number) => {
    triggerHaptic('selection');
    const available = Math.max(0, fromBalance);
    const calculated = (available * percent).toFixed(2);
    setAmount(calculated);
  };

  const handleTypeSelect = (selectedType: 'expense' | 'income' | 'transfer') => {
    triggerHaptic('selection');
    setType(selectedType);
  };

  const handleTransfer = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid transfer amount.');
      triggerHaptic('notificationError');
      return;
    }

    if (!currentAccountId || !currentUser) {
      Alert.alert('Error', 'Active account not found.');
      return;
    }

    if (!fromWalletId || !toWalletId || fromWalletId === toWalletId) {
      Alert.alert('Routing Error', 'Source and destination wallets must be different.');
      triggerHaptic('notificationError');
      return;
    }

    const isCreditWallet =
      fromWallet?.icon?.includes('credit') || fromWallet?.name?.toLowerCase().includes('credit');
    if (!isCreditWallet && numAmount > fromBalance + 0.0001) {
      Alert.alert(
        'Insufficient Balance',
        `Available balance in ${fromWallet?.name || 'source'} is ${formatCurrency(fromBalance, baseCurrency)}.`,
      );
      triggerHaptic('notificationError');
      return;
    }

    try {
      setSaving(true);
      await transferBetweenWallets(
        currentAccountId,
        currentUser.id,
        fromWalletId,
        toWalletId,
        numAmount,
        description.trim() || undefined,
        baseCurrency,
      );

      await syncBalancesFromDatabase(currentAccountId);

      triggerHaptic('notificationSuccess');
      Alert.alert(
        'Transfer Complete',
        `${formatCurrency(numAmount, baseCurrency)} moved from ${fromWallet?.name || 'source'} to ${toWallet?.name || 'destination'}`,
        [{ text: 'DONE', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      triggerHaptic('notificationError');
      Alert.alert('Transfer Error', err?.message || 'Failed to complete transfer.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      triggerHaptic('notificationError');
      return;
    }

    if (!selectedCategoryId) {
      Alert.alert('Category Required', 'Please pick a category.');
      triggerHaptic('notificationError');
      return;
    }

    if (!currentAccountId || !selectedWalletId) {
      Alert.alert('Wallet Required', 'Please select a destination wallet.');
      return;
    }

    try {
      setSaving(true);
      const txRepo = new TransactionRepository();
      const txId = editTransactionId || uuidv4();

      // Process attached images
      let savedImagePaths: string[] = [];
      for (let i = 0; i < selectedImageUris.length; i++) {
        const uri = selectedImageUris[i];
        if (uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('content://')) {
          try {
            const saved = await compressAndSaveImage(uri, `${txId}_${i}`);
            savedImagePaths.push(saved.originalPath);
          } catch {
            savedImagePaths.push(uri);
          }
        } else {
          savedImagePaths.push(uri);
        }
      }

      const txPayload = {
        accountId: currentAccountId,
        type,
        amount: numAmount,
        categoryId: selectedCategoryId,
        description: description.trim(),
        date,
        vaultType: selectedWalletId as VaultType,
        walletId: selectedWalletId,
        currency,
        originalAmount: currency !== baseCurrency ? numAmount : undefined,
        exchangeRate: currency !== baseCurrency ? exchangeRate : undefined,
        convertedAmount: currency !== baseCurrency ? convertedAmount : numAmount,
        imagePath: savedImagePaths[0] || undefined,
        images: savedImagePaths,
        isRecurring: false,
      };

      if (isEditMode && editTransactionId) {
        await txRepo.update(editTransactionId, txPayload);
      } else {
        await txRepo.create(txPayload);
      }

      // Synchronize derived balances
      await syncBalancesFromDatabase(currentAccountId);

      triggerHaptic('notificationSuccess');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save transaction.');
      triggerHaptic('notificationError');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator color={themeColors.text} size="small" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: themeColors.background }]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Segmented Type Switch */}
        <View
          style={[
            styles.typeSwitchContainer,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleTypeSelect('expense')}
            style={[
              styles.typeTab,
              type === 'expense' && {
                backgroundColor: themeColors.text,
              },
            ]}
          >
            <Text
              style={[
                styles.typeTabText,
                {
                  color: type === 'expense' ? themeColors.background : themeColors.text,
                },
              ]}
            >
              EXPENSE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleTypeSelect('income')}
            style={[
              styles.typeTab,
              type === 'income' && {
                backgroundColor: themeColors.text,
              },
            ]}
          >
            <Text
              style={[
                styles.typeTabText,
                {
                  color: type === 'income' ? themeColors.background : themeColors.text,
                },
              ]}
            >
              INCOME
            </Text>
          </TouchableOpacity>

          {!isEditMode && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleTypeSelect('transfer')}
              style={[
                styles.typeTab,
                type === 'transfer' && {
                  backgroundColor: themeColors.text,
                },
              ]}
            >
              <Text
                style={[
                  styles.typeTabText,
                  {
                    color: type === 'transfer' ? themeColors.background : themeColors.textMuted,
                  },
                ]}
              >
                TRANSFER ⇄
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {type === 'transfer' ? (
          <>
            {/* Visual From -> To Route Card */}
            <View
              style={[
                styles.routeCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.cardBorder,
                },
              ]}
            >
              {/* Source Wallet Block */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic('selection');
                  setWalletPickerTarget('from');
                }}
                style={styles.walletBox}
              >
                <View style={styles.walletMetaTop}>
                  <Text style={[styles.microLabel, { color: themeColors.textMuted }]}>
                    FROM SOURCE WALLET
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={16}
                    color={themeColors.textMuted}
                  />
                </View>

                <View style={styles.walletSelectedRow}>
                  <View
                    style={[
                      styles.iconSmall,
                      {
                        backgroundColor: themeColors.background,
                        borderColor: themeColors.hairline,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={fromWallet?.icon || 'wallet-outline'}
                      size={16}
                      color={themeColors.text}
                    />
                  </View>
                  <Text
                    style={[styles.walletTitleText, { color: themeColors.text }]}
                    numberOfLines={1}
                  >
                    {fromWallet?.name || 'Select Wallet'}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.balanceSubtext,
                    { color: fromBalance < 0 ? themeColors.error : themeColors.textMuted },
                  ]}
                >
                  AVAILABLE: {formatCurrency(fromBalance, baseCurrency)}
                </Text>
              </TouchableOpacity>

              {/* Hairline Divider & Swap Button */}
              <View style={styles.dividerRow}>
                <View style={[styles.hairlineSegment, { backgroundColor: themeColors.hairline }]} />
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSwapWallets}
                  style={[
                    styles.swapButton,
                    {
                      backgroundColor: themeColors.surface,
                      borderColor: themeColors.cardBorder,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="swap-vertical"
                    size={20}
                    color={themeColors.text}
                  />
                </TouchableOpacity>
                <View style={[styles.hairlineSegment, { backgroundColor: themeColors.hairline }]} />
              </View>

              {/* Destination Wallet Block */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic('selection');
                  setWalletPickerTarget('to');
                }}
                style={styles.walletBox}
              >
                <View style={styles.walletMetaTop}>
                  <Text style={[styles.microLabel, { color: themeColors.textMuted }]}>
                    TO DESTINATION WALLET
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={16}
                    color={themeColors.textMuted}
                  />
                </View>

                <View style={styles.walletSelectedRow}>
                  <View
                    style={[
                      styles.iconSmall,
                      {
                        backgroundColor: themeColors.background,
                        borderColor: themeColors.hairline,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={toWallet?.icon || 'wallet-outline'}
                      size={16}
                      color={themeColors.text}
                    />
                  </View>
                  <Text
                    style={[styles.walletTitleText, { color: themeColors.text }]}
                    numberOfLines={1}
                  >
                    {toWallet?.name || 'Select Wallet'}
                  </Text>
                </View>

                <Text style={[styles.balanceSubtext, { color: themeColors.textMuted }]}>
                  CURRENT: {formatCurrency(toBalance, baseCurrency)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Transfer Amount Input Card */}
            <View
              style={[
                styles.amountCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.cardBorder,
                },
              ]}
            >
              <Text style={[styles.microLabel, { color: themeColors.textMuted, marginBottom: 8 }]}>
                TRANSFER AMOUNT ({baseCurrency})
              </Text>

              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={themeColors.textMuted}
                keyboardType="decimal-pad"
                style={[styles.amountInput, { color: themeColors.text }]}
                autoFocus={!isEditMode}
              />

              {/* Quick Percentage Chips */}
              <View style={styles.chipsRow}>
                <TouchableOpacity
                  onPress={() => handleQuickPercent(0.25)}
                  style={[styles.chip, { borderColor: themeColors.hairline }]}
                >
                  <Text style={[styles.chipText, { color: themeColors.text }]}>25%</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleQuickPercent(0.5)}
                  style={[styles.chip, { borderColor: themeColors.hairline }]}
                >
                  <Text style={[styles.chipText, { color: themeColors.text }]}>50%</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleQuickPercent(1.0)}
                  style={[
                    styles.chip,
                    {
                      borderColor: themeColors.text,
                      backgroundColor: themeColors.text,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: themeColors.background }]}>MAX</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Optional Note / Memo */}
            <View
              style={[
                styles.noteCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.cardBorder,
                },
              ]}
            >
              <Text style={[styles.microLabel, { color: themeColors.textMuted, marginBottom: 8 }]}>
                OPTIONAL NOTE
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Savings allocation, Rent coverage"
                placeholderTextColor={themeColors.textMuted}
                style={[
                  styles.noteInput,
                  {
                    color: themeColors.text,
                    borderColor: themeColors.hairline,
                    backgroundColor: themeColors.background,
                  },
                ]}
              />
            </View>

          </>
        ) : (
          <>
            {/* 2. Hero Tabular Amount Card */}
            <View
          style={[
            styles.amountCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          <View style={styles.amountHeaderRow}>
            <Text style={[styles.microLabel, { color: themeColors.textMuted }]}>
              TRANSACTION AMOUNT
            </Text>

            {/* Currency Chip */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('selection');
                setCurrencyPickerVisible(true);
              }}
              style={[
                styles.currencyChip,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.background,
                },
              ]}
            >
              <Text style={[styles.currencyChipText, { color: themeColors.text }]}>
                {currency} ▾
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={themeColors.textMuted}
            keyboardType="decimal-pad"
            style={[
              styles.amountInput,
              {
                color: type === 'income' ? themeColors.success : themeColors.text,
              },
            ]}
            autoFocus={!isEditMode}
          />

          {/* Dual Currency Converted Preview */}
          {convertedAmount !== undefined && currency !== baseCurrency && (
            <View style={styles.dualCurrencyPreview}>
              <Text style={[styles.dualCurrencyText, { color: themeColors.textMuted }]}>
                ≈ {formatCurrency(convertedAmount, baseCurrency)} ({baseCurrency})
              </Text>
            </View>
          )}

          {/* Quick Wallet Selector Chip */}
          <View style={styles.walletChipRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('selection');
                setWalletPickerTarget('single');
              }}
              style={[
                styles.walletChip,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.background,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={selectedWallet?.icon || 'wallet-outline'}
                size={14}
                color={themeColors.text}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.walletChipText, { color: themeColors.text }]}>
                {selectedWallet?.name || 'Select Wallet'} ▾
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Category Grid */}
        <View style={styles.categorySection}>
          <View style={styles.categoryTitleRow}>
            <Text style={[styles.sectionTitle, styles.titleNoMargin, { color: themeColors.textMuted }]}>
              SELECT CATEGORY
            </Text>
            {categorizing && (
              <Text style={[styles.layaStatus, { color: themeColors.textMuted }]}>LAYA THINKING…</Text>
            )}
          </View>

          {categoryProposal && (
            <View
              style={[
                styles.proposalBanner,
                { borderColor: themeColors.hairline, backgroundColor: themeColors.surface },
              ]}
            >
              <View style={styles.proposalTextWrap}>
                <Text style={[styles.proposalLabel, { color: themeColors.textMuted }]}>
                  LAYA SUGGESTS A NEW CATEGORY
                </Text>
                <Text style={[styles.proposalName, { color: themeColors.text }]} numberOfLines={1}>
                  {categoryProposal.name}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={addingProposal}
                onPress={handleAddProposedCategory}
                style={[
                  styles.proposalAddButton,
                  { borderColor: themeColors.text, backgroundColor: themeColors.text },
                ]}
              >
                {addingProposal ? (
                  <ActivityIndicator size="small" color={themeColors.background} />
                ) : (
                  <Text style={[styles.proposalAddText, { color: themeColors.background }]}>+ ADD</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.categoryGrid}>
            {filteredCategories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic('selection');
                    manualCategoryRef.current = true;
                    setSelectedCategoryId(cat.id);
                  }}
                  style={[
                    styles.categoryCard,
                    {
                      borderColor: isSelected ? themeColors.text : themeColors.hairline,
                      backgroundColor: isSelected ? themeColors.surfaceHighlight : themeColors.surface,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.categoryIconBadge,
                      {
                        backgroundColor: isSelected ? themeColors.text : themeColors.background,
                        borderColor: isSelected ? themeColors.text : themeColors.hairline,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon || 'tag-outline'}
                      size={18}
                      color={isSelected ? themeColors.background : themeColors.text}
                    />
                  </View>
                  <Text
                    style={[
                      styles.categoryName,
                      {
                        color: isSelected ? themeColors.text : themeColors.textMuted,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. Optional Details (Note & Date & Receipt) */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          <Text style={[styles.microLabel, { color: themeColors.textMuted, marginBottom: 8 }]}>
            DETAILS & RECEIPT
          </Text>

          {/* Description input */}
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Merchant or memo (optional)"
            placeholderTextColor={themeColors.textMuted}
            style={[
              styles.inputField,
              {
                color: themeColors.text,
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.background,
              },
            ]}
          />

          {/* Date row */}
          <View style={styles.dateRow}>
            <Text style={[styles.dateLabel, { color: themeColors.textMuted }]}>
              DATE: {format(new Date(date), 'dd MMM yyyy')}
            </Text>
          </View>

          {/* Receipt Attachment */}
          <View style={styles.receiptRow}>
            <ImagePickerButton
              selectedImageUris={selectedImageUris}
              onImagesChanged={setSelectedImageUris}
            />
          </View>
        </View>

          </>
        )}
      </ScrollView>

      {/* Floating Submit Button — outside ScrollView, fixed at bottom */}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={saving}
        onPress={type === 'transfer' ? handleTransfer : handleSave}
        style={[
          styles.floatingButton,
          {
            backgroundColor: themeColors.text,
          },
        ]}
      >
        {saving ? (
          <ActivityIndicator color={themeColors.background} size="small" />
        ) : (
          <Text style={[styles.submitButtonText, { color: themeColors.background }]}>
            {type === 'transfer'
              ? 'CONFIRM TRANSFER'
              : isEditMode
              ? 'UPDATE TRANSACTION'
              : 'LOG TRANSACTION'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Wallet Picker Modal */}
      <Modal
        visible={walletPickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setWalletPickerTarget(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setWalletPickerTarget(null)}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.cardBorder,
              },
            ]}
          >
            <View style={[styles.sheetHeader, { borderBottomColor: themeColors.hairline }]}>
              <Text style={[styles.sheetTitle, { color: themeColors.text }]}>
                {walletPickerTarget === 'from'
                  ? 'SELECT SOURCE WALLET'
                  : walletPickerTarget === 'to'
                  ? 'SELECT DESTINATION WALLET'
                  : 'SELECT WALLET'}
              </Text>
              <TouchableOpacity onPress={() => setWalletPickerTarget(null)}>
                <MaterialCommunityIcons name="close" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {wallets.map((w) => {
                const currentSelected =
                  walletPickerTarget === 'from'
                    ? fromWalletId
                    : walletPickerTarget === 'to'
                    ? toWalletId
                    : selectedWalletId;
                const isSelected = currentSelected === w.id;
                const b = derivedBalances[w.id] ?? 0;
                return (
                  <TouchableOpacity
                    key={w.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerHaptic('selection');
                      if (walletPickerTarget === 'from') {
                        setFromWalletId(w.id);
                      } else if (walletPickerTarget === 'to') {
                        setToWalletId(w.id);
                      } else {
                        setSelectedWalletId(w.id);
                      }
                      setWalletPickerTarget(null);
                    }}
                    style={[
                      styles.pickerRow,
                      { borderBottomColor: themeColors.hairline },
                    ]}
                  >
                    <View style={styles.pickerLeft}>
                      <MaterialCommunityIcons
                        name={w.icon || 'wallet-outline'}
                        size={18}
                        color={themeColors.text}
                        style={{ marginRight: 10 }}
                      />
                      <View>
                        <Text style={[styles.pickerName, { color: themeColors.text }]}>
                          {w.name}
                        </Text>
                        <Text style={[styles.pickerBalance, { color: themeColors.textMuted }]}>
                          {formatCurrency(b, baseCurrency)}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={18} color={themeColors.text} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal
        visible={currencyPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyPickerVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setCurrencyPickerVisible(false)}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.cardBorder,
              },
            ]}
          >
            <View style={[styles.sheetHeader, { borderBottomColor: themeColors.hairline }]}>
              <Text style={[styles.sheetTitle, { color: themeColors.text }]}>
                SELECT CURRENCY
              </Text>
              <TouchableOpacity onPress={() => setCurrencyPickerVisible(false)}>
                <MaterialCommunityIcons name="close" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {POPULAR_CURRENCIES.map((code) => {
                const isSelected = currency === code;
                return (
                  <TouchableOpacity
                    key={code}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerHaptic('selection');
                      setCurrency(code);
                      setCurrencyPickerVisible(false);
                    }}
                    style={[
                      styles.pickerRow,
                      { borderBottomColor: themeColors.hairline },
                    ]}
                  >
                    <Text style={[styles.pickerName, { color: themeColors.text }]}>
                      {code}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={18} color={themeColors.text} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  typeSwitchContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 3,
    marginBottom: 16,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  typeTabText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  amountCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 18,
    marginBottom: 16,
  },
  amountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  microLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  currencyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 2,
  },
  currencyChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    padding: 0,
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  dualCurrencyPreview: {
    marginTop: 4,
  },
  dualCurrencyText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  walletChipRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  walletChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categorySection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  titleNoMargin: {
    marginBottom: 0,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  layaStatus: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  proposalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 10,
  },
  proposalTextWrap: {
    flex: 1,
  },
  proposalLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  proposalName: {
    fontSize: 13,
    fontWeight: '700',
  },
  proposalAddButton: {
    borderWidth: 1,
    borderRadius: 2,
    paddingVertical: 7,
    paddingHorizontal: 12,
    minWidth: 56,
    alignItems: 'center',
  },
  proposalAddText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '31.5%',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  categoryIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 11,
    textAlign: 'center',
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 16,
    marginBottom: 20,
  },
  inputField: {
    height: 42,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  dateRow: {
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  receiptRow: {
    marginTop: 4,
  },
  submitButton: {
    height: 48,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: Platform.OS === 'ios' ? 24 : 16,
    height: 52,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  pickerBalance: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  routeCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 16,
    marginBottom: 16,
  },
  walletBox: {
    paddingVertical: 4,
  },
  walletMetaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  walletSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconSmall: {
    width: 28,
    height: 28,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  walletTitleText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  balanceSubtext: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  hairlineSegment: {
    flex: 1,
    height: 1,
  },
  swapButton: {
    width: 34,
    height: 34,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 2,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  noteCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 16,
    marginBottom: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
});
