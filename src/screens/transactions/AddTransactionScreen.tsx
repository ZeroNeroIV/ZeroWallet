// Simplizum Log & Edit Transaction — Swift Minimalist Flow with Tabular Figures & Category Grid
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { syncBalancesFromDatabase } from '../../services/walletTransferService';
import { convertCurrency } from '../../services/currencyService';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import { ImagePickerButton } from '../../components/forms/ImagePickerButton';
import { compressAndSaveImage } from '../../utils/imageStorage';

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

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
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
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

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

        const [acc, wList, cList] = await Promise.all([
          accRepo.findById(currentAccountId),
          walletRepo.findByAccount(currentAccountId),
          catRepo.findByUser(currentUser.id),
        ]);

        const accCur = acc?.currency || 'USD';
        setBaseCurrency(accCur);
        setCurrency(accCur);
        setWallets(wList);
        setCategories(cList);

        // Preselect default wallet
        const defaultWallet = wList.find((w) => w.isDefault) || wList[0];
        if (defaultWallet) setSelectedWalletId(defaultWallet.id);

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

  const handleTypeSelect = (selectedType: 'expense' | 'income' | 'transfer') => {
    triggerHaptic('selection');
    if (selectedType === 'transfer') {
      navigation.navigate('Transfer');
      return;
    }
    setType(selectedType);
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

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleTypeSelect('transfer')}
            style={styles.typeTab}
          >
            <Text style={[styles.typeTabText, { color: themeColors.textMuted }]}>
              TRANSFER ⇄
            </Text>
          </TouchableOpacity>
        </View>

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
                setWalletPickerVisible(true);
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
          <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>
            SELECT CATEGORY
          </Text>

          <View style={styles.categoryGrid}>
            {filteredCategories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic('selection');
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

        {/* 5. Submit Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={saving}
          onPress={handleSave}
          style={[
            styles.submitButton,
            {
              backgroundColor: themeColors.text,
              borderColor: themeColors.text,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={themeColors.background} size="small" />
          ) : (
            <Text style={[styles.submitButtonText, { color: themeColors.background }]}>
              {isEditMode ? 'UPDATE TRANSACTION' : 'LOG TRANSACTION'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Wallet Picker Modal */}
      <Modal
        visible={walletPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWalletPickerVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setWalletPickerVisible(false)}
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
                SELECT WALLET
              </Text>
              <TouchableOpacity onPress={() => setWalletPickerVisible(false)}>
                <MaterialCommunityIcons name="close" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {wallets.map((w) => {
                const isSelected = selectedWalletId === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerHaptic('selection');
                      setSelectedWalletId(w.id);
                      setWalletPickerVisible(false);
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
                      <Text style={[styles.pickerName, { color: themeColors.text }]}>
                        {w.name}
                      </Text>
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
    paddingBottom: 40,
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
});
