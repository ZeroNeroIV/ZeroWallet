// Simplizum Transfer Screen — Dedicated Visual Route Transfer with Live Derived Balances
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { MainStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { transferBetweenWallets, syncBalancesFromDatabase } from '../../services/walletTransferService';
import { useWallets } from '../../hooks/useWallets';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import type { Wallet } from '../../types/models';

type TransferNavigationProp = StackNavigationProp<MainStackParamList, 'Transfer'>;
type TransferRouteProp = RouteProp<MainStackParamList, 'Transfer'>;

export default function TransferScreen() {
  const navigation = useNavigation<TransferNavigationProp>();
  const route = useRoute<TransferRouteProp>();
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentAccountId = useAuthStore((state) => state.currentAccountId);
  const themeColors = useThemeColors();

  const { wallets } = useWallets();
  const [derivedBalances, setDerivedBalances] = useState<Record<string, number>>({});
  const [accountCurrency, setAccountCurrency] = useState('USD');

  const [fromWalletId, setFromWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletPickerMode, setWalletPickerMode] = useState<'from' | 'to' | null>(null);

  // Load live derived balances and currency
  const loadLiveBalances = useCallback(async () => {
    if (!currentAccountId) return;
    try {
      const [acc, balances] = await Promise.all([
        new AccountRepository().findById(currentAccountId),
        new WalletRepository().getDerivedBalances(currentAccountId),
      ]);
      if (acc?.currency) setAccountCurrency(acc.currency);
      setDerivedBalances(balances);
    } catch (err) {
      console.warn('[TransferScreen] loadLiveBalances error:', err);
    }
  }, [currentAccountId]);

  useFocusEffect(
    useCallback(() => {
      loadLiveBalances();
      if (currentAccountId) {
        syncBalancesFromDatabase(currentAccountId).catch(() => {});
      }
    }, [loadLiveBalances, currentAccountId])
  );

  // Initialize selected wallets based on route params or available wallets
  useEffect(() => {
    if (wallets.length < 2) return;

    const paramFrom = route.params?.fromWalletId;
    const paramTo = route.params?.toWalletId;

    if (paramFrom && wallets.some((w) => w.id === paramFrom)) {
      setFromWalletId(paramFrom);
    } else if (!fromWalletId || !wallets.some((w) => w.id === fromWalletId)) {
      setFromWalletId(wallets[0].id);
    }

    if (paramTo && wallets.some((w) => w.id === paramTo)) {
      setToWalletId(paramTo);
    } else if (!toWalletId || toWalletId === fromWalletId || !wallets.some((w) => w.id === toWalletId)) {
      const fallback = wallets.find((w) => w.id !== (paramFrom || wallets[0].id));
      if (fallback) setToWalletId(fallback.id);
    }
  }, [wallets, route.params]);

  const fromWallet = useMemo(() => wallets.find((w) => w.id === fromWalletId), [wallets, fromWalletId]);
  const toWallet = useMemo(() => wallets.find((w) => w.id === toWalletId), [wallets, toWalletId]);

  const fromBalance = (fromWalletId ? derivedBalances[fromWalletId] : 0) ?? 0;
  const toBalance = (toWalletId ? derivedBalances[toWalletId] : 0) ?? 0;

  const isCreditWallet = useMemo(() => {
    return fromWallet?.icon?.includes('credit') || fromWallet?.name?.toLowerCase().includes('credit');
  }, [fromWallet]);

  // Swap From and To
  const handleSwapWallets = () => {
    triggerHaptic('impactLight');
    const prevFrom = fromWalletId;
    setFromWalletId(toWalletId);
    setToWalletId(prevFrom);
  };

  // Percentage quick-fills
  const handleQuickPercent = (percent: number) => {
    triggerHaptic('selection');
    const available = Math.max(0, fromBalance);
    const calculated = (available * percent).toFixed(2);
    setAmount(calculated);
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

    if (!isCreditWallet && numAmount > fromBalance + 0.0001) {
      Alert.alert(
        'Insufficient Balance',
        `Available balance in ${fromWallet?.name || 'source'} is ${formatCurrency(fromBalance, accountCurrency)}.`,
      );
      triggerHaptic('notificationError');
      return;
    }

    try {
      setLoading(true);
      await transferBetweenWallets(
        currentAccountId,
        currentUser.id,
        fromWalletId,
        toWalletId,
        numAmount,
        description.trim() || undefined,
        accountCurrency,
      );

      triggerHaptic('notificationSuccess');
      Alert.alert(
        'Transfer Complete',
        `${formatCurrency(numAmount, accountCurrency)} moved from ${fromWallet?.name} to ${toWallet?.name}`,
        [{ text: 'DONE', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      triggerHaptic('notificationError');
      Alert.alert('Transfer Error', err?.message || 'Failed to complete transfer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Segmented Type Switch */}
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
            onPress={() => {
              triggerHaptic('selection');
              navigation.replace('AddTransaction', { type: 'expense' });
            }}
            style={styles.typeTab}
          >
            <Text style={[styles.typeTabText, { color: themeColors.textMuted }]}>
              EXPENSE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('selection');
              navigation.replace('AddTransaction', { type: 'income' });
            }}
            style={styles.typeTab}
          >
            <Text style={[styles.typeTabText, { color: themeColors.textMuted }]}>
              INCOME
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.typeTab,
              {
                backgroundColor: themeColors.text,
              },
            ]}
          >
            <Text
              style={[
                styles.typeTabText,
                {
                  color: themeColors.background,
                },
              ]}
            >
              TRANSFER ⇄
            </Text>
          </TouchableOpacity>
        </View>

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
              setWalletPickerMode('from');
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
              AVAILABLE: {formatCurrency(fromBalance, accountCurrency)}
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
              setWalletPickerMode('to');
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
              CURRENT: {formatCurrency(toBalance, accountCurrency)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input Block */}
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
            TRANSFER AMOUNT ({accountCurrency})
          </Text>

          <View style={styles.amountInputRow}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={themeColors.textMuted}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: themeColors.text }]}
              autoFocus
            />
          </View>

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

        {/* Confirm Transfer Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={loading}
          onPress={handleTransfer}
          style={[
            styles.submitButton,
            {
              backgroundColor: themeColors.text,
              borderColor: themeColors.text,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={themeColors.background} size="small" />
          ) : (
            <Text style={[styles.submitButtonText, { color: themeColors.background }]}>
              CONFIRM TRANSFER
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Wallet Selector Sheet Modal */}
      <Modal
        visible={walletPickerMode !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setWalletPickerMode(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setWalletPickerMode(null)}
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
                {walletPickerMode === 'from' ? 'SELECT SOURCE WALLET' : 'SELECT DESTINATION WALLET'}
              </Text>
              <TouchableOpacity onPress={() => setWalletPickerMode(null)}>
                <MaterialCommunityIcons name="close" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {wallets.map((w) => {
                const isSelected =
                  walletPickerMode === 'from' ? fromWalletId === w.id : toWalletId === w.id;
                const isOpposite =
                  walletPickerMode === 'from' ? toWalletId === w.id : fromWalletId === w.id;
                const b = derivedBalances[w.id] ?? 0;

                return (
                  <TouchableOpacity
                    key={w.id}
                    disabled={isOpposite}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerHaptic('selection');
                      if (walletPickerMode === 'from') {
                        setFromWalletId(w.id);
                      } else {
                        setToWalletId(w.id);
                      }
                      setWalletPickerMode(null);
                    }}
                    style={[
                      styles.pickerOption,
                      {
                        borderBottomColor: themeColors.hairline,
                        opacity: isOpposite ? 0.4 : 1,
                      },
                    ]}
                  >
                    <View style={styles.pickerLeft}>
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
                          name={w.icon || 'wallet-outline'}
                          size={16}
                          color={themeColors.text}
                        />
                      </View>
                      <View>
                        <Text style={[styles.pickerName, { color: themeColors.text }]}>
                          {w.name}
                        </Text>
                        <Text style={[styles.pickerBalance, { color: themeColors.textMuted }]}>
                          {formatCurrency(b, accountCurrency)}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color={themeColors.text}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  routeCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs, // 2px subtle corner
    padding: 16,
    marginBottom: 16,
  },
  walletBox: {
    paddingVertical: 4,
  },
  microLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
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
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
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
    marginVertical: 12,
  },
  hairlineSegment: {
    flex: 1,
    height: 1,
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  amountCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 18,
    marginBottom: 16,
  },
  amountInputRow: {
    marginBottom: 14,
  },
  amountInput: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 2,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  noteCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 16,
    marginBottom: 24,
  },
  noteInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    fontSize: 14,
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
  pickerOption: {
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
    marginBottom: 2,
  },
  pickerBalance: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
