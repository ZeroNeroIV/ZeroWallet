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
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { calculateVaultBalances } from '../../utils/balanceCalculator';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Account } from '../../types/models';

type TransferNavigationProp = StackNavigationProp<MainStackParamList, 'Transfer'>;

export default function TransferScreen() {
  const navigation = useNavigation<TransferNavigationProp>();
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentAccountId = useAuthStore((state) => state.currentAccountId);
  const balances = useAccountStore((state) => state.balances);
  const updateBalance = useAccountStore((state) => state.updateBalance);
  const themeColors = useThemeColors();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccountId, setFromAccountId] = useState<string>(currentAccountId || '');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; to?: string }>({});

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    if (!currentUser) return;
    const accountRepo = new AccountRepository();
    const userAccounts = await accountRepo.findByUser(currentUser.id);
    setAccounts(userAccounts);

    if (userAccounts.length >= 2) {
      const other = userAccounts.find((a) => a.id !== currentAccountId);
      if (other && !toAccountId) {
        setToAccountId(other.id);
      }
    }
  };

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const fromBalance = fromAccountId ? balances[fromAccountId] : null;
  const maxAmount = fromBalance ? fromBalance.availableBalance : 0;

  const handleTransfer = async () => {
    setErrors({});

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setErrors({ amount: 'Please enter a valid amount' });
      return;
    }

    if (!fromAccountId) {
      Alert.alert('Error', 'Please select a source account');
      return;
    }

    if (!toAccountId) {
      setErrors({ to: 'Please select a destination account' });
      return;
    }

    if (fromAccountId === toAccountId) {
      Alert.alert('Error', 'Source and destination accounts must be different');
      return;
    }

    if (numAmount > maxAmount) {
      setErrors({ amount: `Insufficient balance. Available: ${maxAmount.toFixed(2)}` });
      return;
    }

    setLoading(true);

    try {
      const txRepo = new TransactionRepository();
      const result = await txRepo.transferBetweenAccounts({
        fromAccountId,
        toAccountId,
        amount: numAmount,
        fromVaultType: 'main',
        toVaultType: 'main',
        description: description.trim() || `Transfer to ${toAccount?.name}`,
        currency: fromAccount?.currency || 'USD',
      });

      // Recalculate and sync both account balances
      const fromTxs = await txRepo.findByAccount(fromAccountId);
      const toTxs = await txRepo.findByAccount(toAccountId);
      updateBalance(fromAccountId, calculateVaultBalances(fromTxs));
      updateBalance(toAccountId, calculateVaultBalances(toTxs));

      Alert.alert(
        'Transfer Complete',
        `${numAmount.toFixed(2)} ${fromAccount?.currency || 'USD'} transferred from ${fromAccount?.name} to ${toAccount?.name}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('[Transfer] Failed:', error);
      Alert.alert('Error', 'Transfer failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderAccountCard = (
    account: Account,
    isSelected: boolean,
    onPress: () => void,
    balance: number,
  ) => (
    <TouchableOpacity
      key={account.id}
      style={[
        styles.accountCard,
        isSelected && styles.accountCardSelected,
        { borderColor: isSelected ? account.color : themeColors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.accountIcon, { backgroundColor: account.color + '20' }]}>
        <Icon name={account.icon} size={24} color={account.color} />
      </View>
      <View style={styles.accountInfo}>
        <Text style={styles.accountName}>{account.name}</Text>
        <Text style={styles.accountBalance}>
          {balance.toFixed(2)} {account.currency}
        </Text>
      </View>
      {isSelected && (
        <Icon name="check-circle" size={24} color={account.color} />
      )}
    </TouchableOpacity>
  );

  if (accounts.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="bank-transfer" size={64} color={themeColors.textSecondary} />
        <Text style={styles.emptyTitle}>Need at least 2 accounts</Text>
        <Text style={styles.emptySubtitle}>
          Create another account first to make transfers
        </Text>
        <Button
          title="Create Account"
          onPress={() => navigation.navigate('CreateAccount')}
          style={styles.emptyButton}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* From Account */}
      <Text style={styles.sectionTitle}>Transfer From</Text>
      {accounts.map((account) => {
        const bal = balances[account.id];
        return renderAccountCard(
          account,
          account.id === fromAccountId,
          () => setFromAccountId(account.id),
          bal ? bal.availableBalance : 0,
        );
      })}

      {/* Amount */}
      <View style={styles.amountSection}>
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          label="Amount"
          currency={fromAccount?.currency ? `${fromAccount.currency} ` : '$'}
          error={errors.amount}
          enableCalculator
        />
        {fromBalance && (
          <TouchableOpacity
            style={styles.maxButton}
            onPress={() => setAmount(maxAmount.toFixed(2))}
          >
            <Text style={styles.maxButtonText}>
              MAX: {maxAmount.toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* To Account */}
      <Text style={styles.sectionTitle}>Transfer To</Text>
      {errors.to && <Text style={styles.errorText}>{errors.to}</Text>}
      {accounts
        .filter((a) => a.id !== fromAccountId)
        .map((account) => {
          const bal = balances[account.id];
          return renderAccountCard(
            account,
            account.id === toAccountId,
            () => setToAccountId(account.id),
            bal ? bal.availableBalance : 0,
          );
        })}

      {/* Description */}
      <View style={styles.descriptionSection}>
        <Input
          label="Description (optional)"
          placeholder="e.g., Move savings to checking"
          value={description}
          onChangeText={setDescription}
          leftIcon="text"
        />
      </View>

      {/* Transfer Summary */}
      {amount && parseFloat(amount) > 0 && fromAccount && toAccount && (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>From</Text>
            <Text style={styles.summaryValue}>{fromAccount.name}</Text>
          </View>
          <Icon name="arrow-down" size={20} color={themeColors.textSecondary} style={styles.summaryArrow} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>To</Text>
            <Text style={styles.summaryValue}>{toAccount.name}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount</Text>
            <Text style={styles.summaryAmount}>
              {parseFloat(amount).toFixed(2)} {fromAccount.currency}
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
          disabled={loading || !amount || !fromAccountId || !toAccountId}
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
    },
    sectionTitle: {
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.semiBold,
      color: themeColors.text,
      marginBottom: spacing.md,
      marginTop: spacing.lg,
    },
    accountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 2,
      borderColor: themeColors.border,
      marginBottom: spacing.sm,
    },
    accountCardSelected: {
      borderWidth: 2,
    },
    accountIcon: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    accountInfo: {
      flex: 1,
    },
    accountName: {
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.semiBold,
      color: themeColors.text,
    },
    accountBalance: {
      fontSize: typography.fontSize.sm,
      color: themeColors.textSecondary,
      marginTop: 2,
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
    errorText: {
      fontSize: typography.fontSize.sm,
      color: themeColors.error,
      marginBottom: spacing.sm,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
      backgroundColor: themeColors.background,
    },
    emptyTitle: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semiBold,
      color: themeColors.text,
      marginTop: spacing.lg,
    },
    emptySubtitle: {
      fontSize: typography.fontSize.md,
      color: themeColors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    emptyButton: {
      marginTop: spacing.xl,
    },
  });
