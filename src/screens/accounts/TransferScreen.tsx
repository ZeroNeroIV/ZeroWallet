/**
 * Purpose: Transfer money between two wallets of the current account
 *
 * Inputs: None (screen; uses current account + user from stores)
 *
 * Outputs:
 *   - Returns (JSX.Element): Wallet-to-wallet transfer form
 *
 * Side effects:
 *   - Records paired transfer transactions and updates balances
 *   - Navigates back on success
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import { AmountInput } from '../../components/forms/AmountInput';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { transferBetweenWallets } from '../../services/walletTransferService';
import { ALL_WALLETS, WALLET_META, getWalletBalance, walletShortName } from '../../utils/wallets';
import type { VaultType } from '../../types/models';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

type TransferNavigationProp = StackNavigationProp<MainStackParamList, 'Transfer'>;

export default function TransferScreen() {
  const navigation = useNavigation<TransferNavigationProp>();
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentAccountId = useAuthStore((state) => state.currentAccountId);
  const balances = useAccountStore((state) => state.balances);
  const themeColors = useThemeColors();

  const [fromWallet, setFromWallet] = useState<VaultType>('main');
  const [toWallet, setToWallet] = useState<VaultType>('savings');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string }>({});

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    const loadCurrency = async () => {
      if (!currentAccountId) return;
      try {
        const account = await new AccountRepository().findById(currentAccountId);
        if (account?.currency) setAccountCurrency(account.currency);
      } catch {
        // keep default
      }
    };
    loadCurrency();
  }, [currentAccountId]);

  const accountBalances = currentAccountId ? balances[currentAccountId] : undefined;
  const fromBalance = getWalletBalance(accountBalances, fromWallet);
  const maxAmount = Math.max(0, fromBalance);

  const handleTransfer = async () => {
    setErrors({});

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setErrors({ amount: 'Please enter a valid amount' });
      return;
    }

    if (!currentAccountId || !currentUser) {
      Alert.alert('Error', 'User not found');
      return;
    }

    if (fromWallet === toWallet) {
      Alert.alert('Error', 'Source and destination wallets must be different');
      return;
    }

    if (numAmount > maxAmount) {
      setErrors({ amount: `Insufficient balance. Available: ${maxAmount.toFixed(3)}` });
      return;
    }

    setLoading(true);

    try {
      await transferBetweenWallets(
        currentAccountId,
        currentUser.id,
        fromWallet,
        toWallet,
        numAmount,
        description.trim() || undefined,
        accountCurrency,
      );

      Alert.alert(
        'Transfer Complete',
        `${numAmount.toFixed(3)} ${accountCurrency} moved from ${walletShortName(fromWallet)} to ${walletShortName(toWallet)}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error('[Transfer] Failed:', error);
      Alert.alert('Error', error?.message || 'Transfer failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderWalletOption = (wallet: VaultType, selected: VaultType, onSelect: (w: VaultType) => void) => {
    const isSelected = selected === wallet;
    const balance = getWalletBalance(accountBalances, wallet);
    return (
      <TouchableOpacity
        key={wallet}
        style={[styles.walletButton, isSelected && styles.walletButtonActive]}
        onPress={() => onSelect(wallet)}
        activeOpacity={0.7}
      >
        <Icon
          name={WALLET_META[wallet].icon as any}
          size={20}
          color={isSelected ? colors.primary.main : colors.neutral.gray600}
        />
        <Text
          style={[
            styles.walletButtonText,
            isSelected && styles.walletButtonTextActive,
          ]}
        >
          {walletShortName(wallet)}
        </Text>
        <Text style={styles.walletBalance}>
          {balance.toFixed(3)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* From Wallet */}
      <Text style={styles.sectionTitle}>Transfer From</Text>
      <View style={styles.walletGrid}>
        {ALL_WALLETS.map((w) =>
          renderWalletOption(w, fromWallet, (next) => {
            setFromWallet(next);
            if (toWallet === next) {
              const fallback = ALL_WALLETS.find((candidate) => candidate !== next);
              if (fallback) setToWallet(fallback);
            }
          })
        )}
      </View>

      {/* Amount */}
      <View style={styles.amountSection}>
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          label={`Amount (${accountCurrency})`}
          error={errors.amount}
          enableCalculator
        />
        <TouchableOpacity
          style={styles.maxButton}
          onPress={() => setAmount(maxAmount.toFixed(3))}
        >
          <Text style={styles.maxButtonText}>
            MAX: {maxAmount.toFixed(3)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* To Wallet */}
      <Text style={styles.sectionTitle}>Transfer To</Text>
      <View style={styles.walletGrid}>
        {ALL_WALLETS.filter((w) => w !== fromWallet).map((w) =>
          renderWalletOption(w, toWallet, setToWallet)
        )}
      </View>

      {/* Description */}
      <View style={styles.descriptionSection}>
        <Input
          label="Description (optional)"
          placeholder="e.g., Move salary to savings"
          value={description}
          onChangeText={setDescription}
          leftIcon="text"
        />
      </View>

      {/* Transfer Summary */}
      {amount && parseFloat(amount) > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>From</Text>
            <Text style={styles.summaryValue}>{walletShortName(fromWallet)}</Text>
          </View>
          <Icon name="arrow-down" size={20} color={themeColors.textSecondary} style={styles.summaryArrow} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>To</Text>
            <Text style={styles.summaryValue}>{walletShortName(toWallet)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount</Text>
            <Text style={styles.summaryAmount}>
              {parseFloat(amount).toFixed(3)} {accountCurrency}
            </Text>
          </View>
        </View>
      )}

      {/* Transfer Button */}
      <View style={styles.footer}>
        <Button
          title="Transfer"
          onPress={handleTransfer}
          loading={loading}
          disabled={loading || !amount || fromWallet === toWallet}
          leftIcon="bank-transfer"
        />
      </View>
    </ScrollView>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.semiBold,
      color: themeColors.text,
      marginBottom: spacing.md,
      marginTop: spacing.lg,
    },
    walletGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    walletButton: {
      flexBasis: '30%',
      flexGrow: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: 12,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
      alignItems: 'center',
      gap: spacing.xs,
    },
    walletButtonActive: {
      backgroundColor: colors.primary.light,
      borderColor: colors.primary.main,
    },
    walletButtonText: {
      ...typography.caption,
      color: colors.neutral.gray600,
      fontWeight: '600',
    },
    walletButtonTextActive: {
      color: colors.primary.main,
    },
    walletBalance: {
      ...typography.caption,
      color: colors.neutral.gray500,
    },
    amountSection: {
      marginTop: spacing.lg,
    },
    maxButton: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      backgroundColor: themeColors.primary + '15',
      borderRadius: borderRadius.sm,
      marginBottom: spacing.sm,
    },
    maxButtonText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semiBold,
      color: themeColors.primary,
    },
    descriptionSection: {
      marginTop: spacing.lg,
    },
    summary: {
      backgroundColor: themeColors.surface,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      marginTop: spacing.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    summaryLabel: {
      fontSize: typography.fontSize.sm,
      color: themeColors.textSecondary,
    },
    summaryValue: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semiBold,
      color: themeColors.text,
    },
    summaryAmount: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: themeColors.primary,
    },
    summaryArrow: {
      alignSelf: 'center',
      marginVertical: spacing.xs,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: themeColors.border,
      marginVertical: spacing.sm,
    },
    footer: {
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
  });
