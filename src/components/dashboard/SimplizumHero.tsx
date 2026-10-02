// Simplizum Hero — Net Worth & Horizontal Minimalist Wallets Strip
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import type { Wallet } from '../../types/models';

interface SimplizumHeroProps {
  totalBalance: number;
  currency: string;
  isBalanceHidden: boolean;
  onToggleHideBalance: () => void;
  wallets: Wallet[];
  walletBalances: Record<string, number>;
  onSelectWallet: (wallet: Wallet) => void;
  onCreateWallet: () => void;
}

export const SimplizumHero: React.FC<SimplizumHeroProps> = ({
  totalBalance,
  currency,
  isBalanceHidden,
  onToggleHideBalance,
  wallets,
  walletBalances,
  onSelectWallet,
  onCreateWallet,
}) => {
  const themeColors = useThemeColors();

  const formattedNetWorth = isBalanceHidden
    ? '••••••••'
    : formatCurrency(totalBalance, currency);

  return (
    <View style={styles.container}>
      {/* Net Worth Block */}
      <View style={styles.netWorthHeader}>
        <Text style={[styles.label, { color: themeColors.textMuted }]}>
          TOTAL NET WORTH
        </Text>
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('selection');
            onToggleHideBalance();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={themeColors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.netWorthAmount, { color: themeColors.text }]}>
        {formattedNetWorth}
      </Text>

      {/* Hairline Divider */}
      <View style={[styles.hairlineDivider, { backgroundColor: themeColors.hairline }]} />

      {/* Horizontal Wallets Strip */}
      <View style={styles.stripWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
        >
          {wallets.map((wallet) => {
            const rawBal = walletBalances[wallet.id] ?? 0;
            const balText = isBalanceHidden ? '••••••' : formatCurrency(rawBal, currency);
            const isNegative = rawBal < 0;

            return (
              <TouchableOpacity
                key={wallet.id}
                style={[
                  styles.walletCard,
                  {
                    borderColor: themeColors.hairline,
                    backgroundColor: themeColors.card,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('impactLight');
                  onSelectWallet(wallet);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.walletHeader}>
                  <Text
                    style={[styles.walletName, { color: themeColors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {wallet.name.toUpperCase()}
                  </Text>
                  <MaterialCommunityIcons
                    name={(wallet.icon as any) || 'wallet-outline'}
                    size={14}
                    color={themeColors.textMuted}
                  />
                </View>

                <Text
                  style={[
                    styles.walletBalance,
                    {
                      color: isNegative ? themeColors.error : themeColors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {balText}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Add Wallet Tile */}
          <TouchableOpacity
            style={[
              styles.addWalletCard,
              {
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.surface,
              },
            ]}
            onPress={() => {
              triggerHaptic('impactMedium');
              onCreateWallet();
            }}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="plus" size={18} color={themeColors.text} />
            <Text style={[styles.addWalletText, { color: themeColors.textSecondary }]}>
              ADD
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingBottom: 8,
  },
  netWorthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  netWorthAmount: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.6,
    paddingHorizontal: 20,
    marginBottom: 20,
    fontVariant: ['tabular-nums'],
  },
  hairlineDivider: {
    height: 1,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  stripWrapper: {
    marginVertical: 4,
  },
  stripContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  walletCard: {
    minWidth: 135,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 6,
  },
  walletName: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    flex: 1,
  },
  walletBalance: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  addWalletCard: {
    width: 68,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  addWalletText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
