import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AmountInput } from '../forms/AmountInput';
import { Button } from '../forms/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { VaultType } from '../../types/models';
import { getWalletBalance, walletShortName } from '../../utils/wallets';
import type { VaultBalances } from '../../utils/balanceCalculator';
import type { Wallet } from '../../types/models';

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
  onTransfer: (from: VaultType, to: VaultType, amount: number) => Promise<void>;
  wallets: Wallet[];
  balances: VaultBalances;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  visible,
  onClose,
  onTransfer,
  wallets,
  balances,
}) => {
  const [fromVault, setFromVault] = useState<VaultType>('main');
  const [toVault, setToVault] = useState<VaultType>('savings');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const vaults = wallets.map((wallet) => ({
    value: wallet.id as VaultType,
    label: wallet.name,
    icon: wallet.icon,
    balance: getWalletBalance(balances, wallet.id),
  }));

  const getVaultBalance = (vault: VaultType) => {
    return getWalletBalance(balances, vault);
  };

  // Keep selections valid when the wallet list loads or changes
  useEffect(() => {
    const ids = wallets.map((w) => w.id);
    if (ids.length === 0) return;
    if (!ids.includes(fromVault)) {
      setFromVault(ids[0]);
    }
    if (!ids.includes(toVault) || toVault === fromVault) {
      setToVault(ids.find((id) => id !== fromVault) ?? ids[0]);
    }
  }, [wallets]);

  const validate = () => {
    setError('');

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    if (fromVault === toVault) {
      setError('Please select different wallets');
      return false;
    }

    const transferAmount = parseFloat(amount);
    const fromBalance = getVaultBalance(fromVault);

    if (transferAmount > fromBalance) {
      setError(`Insufficient balance in ${walletShortName(fromVault)} wallet`);
      return false;
    }

    return true;
  };

  const handleTransfer = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await onTransfer(fromVault, toVault, parseFloat(amount));
      setAmount('');
      setError('');
      Alert.alert('Success', 'Transfer completed successfully');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
      Alert.alert('Error', err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSwapVaults = () => {
    const temp = fromVault;
    setFromVault(toVault);
    setToVault(temp);
  };

  const resetAndClose = () => {
    setAmount('');
    setError('');
    setFromVault('main');
    setToVault('savings');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={resetAndClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Transfer Between Wallets</Text>
            <TouchableOpacity onPress={resetAndClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.neutral.gray700}
              />
            </TouchableOpacity>
          </View>

          {/* From Vault */}
          <View style={styles.section}>
            <Text style={styles.label}>From</Text>
            <View style={styles.vaultOptions}>
              {vaults.map((vault) => (
                <TouchableOpacity
                  key={vault.value}
                  style={[
                    styles.vaultButton,
                    fromVault === vault.value && styles.vaultButtonActive,
                  ]}
                  onPress={() => setFromVault(vault.value)}
                >
                  <MaterialCommunityIcons
                    name={vault.icon as any}
                    size={20}
                    color={
                      fromVault === vault.value
                        ? colors.primary.main
                        : colors.neutral.gray600
                    }
                  />
                  <Text
                    style={[
                      styles.vaultButtonText,
                      fromVault === vault.value && styles.vaultButtonTextActive,
                    ]}
                  >
                    {vault.label}
                  </Text>
                  <Text style={styles.vaultBalance}>
                    ${vault.balance.toFixed(3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Swap Button */}
          <View style={styles.swapContainer}>
            <TouchableOpacity style={styles.swapButton} onPress={handleSwapVaults}>
              <MaterialCommunityIcons
                name="swap-vertical"
                size={24}
                color={colors.primary.main}
              />
            </TouchableOpacity>
          </View>

          {/* To Vault */}
          <View style={styles.section}>
            <Text style={styles.label}>To</Text>
            <View style={styles.vaultOptions}>
              {vaults.map((vault) => (
                <TouchableOpacity
                  key={vault.value}
                  style={[
                    styles.vaultButton,
                    toVault === vault.value && styles.vaultButtonActive,
                  ]}
                  onPress={() => setToVault(vault.value)}
                >
                  <MaterialCommunityIcons
                    name={vault.icon as any}
                    size={20}
                    color={
                      toVault === vault.value
                        ? colors.primary.main
                        : colors.neutral.gray600
                    }
                  />
                  <Text
                    style={[
                      styles.vaultButtonText,
                      toVault === vault.value && styles.vaultButtonTextActive,
                    ]}
                  >
                    {vault.label}
                  </Text>
                  <Text style={styles.vaultBalance}>
                    ${vault.balance.toFixed(3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Amount Input */}
          <AmountInput
            value={amount}
            onChangeText={setAmount}
            label="Amount"
            error={error}
          />

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title="Cancel"
              onPress={resetAndClose}
              variant="outline"
              style={styles.cancelButton}
            />
            <Button
              title="Transfer"
              onPress={handleTransfer}
              loading={loading}
              style={styles.transferButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.neutral.gray900,
  },
  section: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.neutral.gray700,
    marginBottom: spacing.sm,
  },
  vaultOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  vaultButton: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray300,
    alignItems: 'center',
    gap: spacing.xs,
  },
  vaultButtonActive: {
    backgroundColor: colors.primary.light,
    borderColor: colors.primary.main,
  },
  vaultButtonText: {
    ...typography.caption,
    color: colors.neutral.gray600,
    fontWeight: '600',
  },
  vaultButtonTextActive: {
    color: colors.primary.main,
  },
  vaultBalance: {
    ...typography.caption,
    color: colors.neutral.gray500,
  },
  swapContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  transferButton: {
    flex: 1,
  },
});
