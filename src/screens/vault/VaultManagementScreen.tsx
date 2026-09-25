import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { VaultCard } from '../../components/bento/VaultCard';
import { TransferModal } from '../../components/vault/TransferModal';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { VaultType } from '../../types/models';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ALL_WALLETS, WALLET_META, getWalletBalance } from '../../utils/wallets';
import { transferBetweenWallets } from '../../services/walletTransferService';
import { AccountRepository } from '../../database/repositories/AccountRepository';

const WALLET_FEATURES: Record<VaultType, string[]> = {
  main: [
    'Use for daily expenses',
    'Included in available balance',
    'Quick access for transactions',
  ],
  savings: [
    'Save for future purchases',
    'Included in available balance',
    'Transfer to investment wallet when needed',
  ],
  held: [
    'Excluded from available balance',
    'For bills and recurring commitments',
    'Prevents accidental spending',
  ],
  salary: [
    'Receives your salary each payday',
    'Included in available balance',
    'Move to spending wallets as needed',
  ],
  emergency: [
    'Emergency fund for tough times',
    'Included in available balance',
    'Avoid spending unless necessary',
  ],
  card: [
    'Money available on your card',
    'Included in available balance',
    'Use for card payments',
  ],
  physical: [
    'Physical cash on hand',
    'Included in available balance',
    'Use for cash payments',
  ],
};

const WALLET_COLORS: Record<VaultType, string> = {
  main: colors.primary.main,
  savings: colors.semantic.success,
  held: colors.semantic.warning,
  salary: '#06D6A0',
  emergency: '#EF476F',
  card: '#118AB2',
  physical: '#F77F00',
};

export const VaultManagementScreen: React.FC = () => {
  const { currentAccountId, currentUser } = useAuthStore();
  const { balances } = useAccountStore();
  const themeColors = useThemeColors();

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [currentBalance, setCurrentBalance] = useState({
    mainBalance: 0,
    savingsBalance: 0,
    heldBalance: 0,
    salaryBalance: 0,
    emergencyBalance: 0,
    cardBalance: 0,
    physicalBalance: 0,
    totalBalance: 0,
    availableBalance: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadBalance();
    }, [currentAccountId, balances])
  );

  const loadBalance = () => {
    if (!currentAccountId) return;

    const balance = balances[currentAccountId] || {
      mainBalance: 0,
      savingsBalance: 0,
      heldBalance: 0,
      salaryBalance: 0,
      emergencyBalance: 0,
      cardBalance: 0,
      physicalBalance: 0,
      totalBalance: 0,
      availableBalance: 0,
    };

    setCurrentBalance(balance);
  };

  const handleTransfer = async (from: VaultType, to: VaultType, amount: number) => {
    if (!currentAccountId || !currentUser) {
      throw new Error('User not found');
    }

    try {
      // Record the move as paired transfer transactions so it stays
      // visible in history and survives balance recalculation
      let currency = 'USD';
      try {
        const account = await new AccountRepository().findById(currentAccountId);
        if (account?.currency) currency = account.currency;
      } catch {
        // keep default
      }
      await transferBetweenWallets(currentAccountId, currentUser.id, from, to, amount, undefined, currency);
      loadBalance();
    } catch (error: any) {
      throw error;
    }
  };

  const vaultDetails = ALL_WALLETS.map((wallet) => ({
    name: WALLET_META[wallet].name,
    category: WALLET_META[wallet].category,
    description: WALLET_META[wallet].description,
    icon: WALLET_META[wallet].icon,
    color: WALLET_COLORS[wallet],
    balance: getWalletBalance(currentBalance, wallet),
    features: WALLET_FEATURES[wallet],
  }));

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Vault Summary Card */}
        <VaultCard
          balances={currentBalance}
          totalBalance={currentBalance.totalBalance}
          availableBalance={currentBalance.availableBalance}
        />

        {/* Transfer Button */}
        <TouchableOpacity
          style={styles.transferButton}
          onPress={() => setTransferModalVisible(true)}
        >
          <MaterialCommunityIcons
            name="swap-horizontal"
            size={24}
            color={colors.neutral.white}
          />
          <Text style={styles.transferButtonText}>Transfer Between Wallets</Text>
        </TouchableOpacity>

        {/* Wallet Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>About Your Wallets</Text>

          {vaultDetails.map((vault, index) => (
            <View key={vault.name} style={styles.vaultDetailCard}>
              <View style={styles.vaultDetailHeader}>
                <View
                  style={[
                    styles.vaultDetailIcon,
                    { backgroundColor: vault.color },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={vault.icon as any}
                    size={24}
                    color={colors.neutral.white}
                  />
                </View>
                <View style={styles.vaultDetailInfo}>
                  <Text style={styles.vaultDetailName}>{vault.name}</Text>
                  <Text style={styles.vaultDetailCategory}>{vault.category}</Text>
                  <Text style={styles.vaultDetailDescription}>
                    {vault.description}
                  </Text>
                </View>
                <Text style={styles.vaultDetailBalance}>
                  ${vault.balance.toFixed(3)}
                </Text>
              </View>

              <View style={styles.featuresContainer}>
                {vault.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={16}
                      color={vault.color}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Info Section */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons
            name="information"
            size={20}
            color={colors.primary.main}
          />
          <Text style={styles.infoText}>
            <Text style={styles.infoTextBold}>Available to Spend</Text> includes
            money from every wallet except Recurring, which is reserved for
            bills to prevent overspending.
          </Text>
        </View>
      </ScrollView>

      {/* Transfer Modal */}
      <TransferModal
        visible={transferModalVisible}
        onClose={() => setTransferModalVisible(false)}
        onTransfer={handleTransfer}
        balances={currentBalance}
      />
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  transferButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.neutral.white,
  },
  detailsContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: themeColors.text,
    marginBottom: spacing.md,
  },
  vaultDetailCard: {
    backgroundColor: themeColors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  vaultDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  vaultDetailIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultDetailInfo: {
    flex: 1,
  },
  vaultDetailName: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: 2,
  },
  vaultDetailCategory: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary.main,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  vaultDetailDescription: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  vaultDetailBalance: {
    ...typography.h3,
    fontWeight: '700',
    color: themeColors.text,
  },
  featuresContainer: {
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.caption,
    color: themeColors.textSecondary,
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary.light,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  infoText: {
    ...typography.caption,
    color: themeColors.textSecondary,
    flex: 1,
  },
  infoTextBold: {
    fontWeight: '600',
    color: colors.primary.main,
  },
});
