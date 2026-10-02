// Simplizum Wallet Architectural Card — 1px hairline, 2px corners, sharp typography
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import type { Wallet } from '../../types/models';

interface WalletArchitecturalCardProps {
  wallet: Wallet;
  balance: number;
  currency: string;
  isBalanceHidden?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export const WalletArchitecturalCard: React.FC<WalletArchitecturalCardProps> = React.memo(({
  wallet,
  balance,
  currency,
  isBalanceHidden = false,
  onPress,
  onLongPress,
}) => {
  const themeColors = useThemeColors();
  const isNegative = balance < -0.001;

  // Determine display type based on icon/name/id
  const getWalletTypeLabel = () => {
    const id = wallet.id.toLowerCase();
    const name = wallet.name.toLowerCase();
    if (id.includes('savings') || name.includes('saving')) return 'SAVINGS';
    if (id.includes('card') || name.includes('credit') || wallet.icon?.includes('credit')) return 'CREDIT';
    if (id.includes('invest') || name.includes('invest') || id === 'main') return 'LIQUID';
    if (id.includes('physical') || name.includes('cash')) return 'CASH';
    if (id.includes('emergency') || name.includes('emergency')) return 'RESERVE';
    if (id.includes('held') || name.includes('vault')) return 'ESCROW';
    return 'WALLET';
  };

  const formattedBalance = isBalanceHidden
    ? '••••••'
    : formatCurrency(balance, currency);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      onLongPress={() => {
        if (onLongPress) {
          triggerHaptic('impactMedium');
          onLongPress();
        }
      }}
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.cardBorder,
        },
      ]}
    >
      {/* Left: Icon Badge + Metadata */}
      <View style={styles.leftCol}>
        <View
          style={[
            styles.iconBadge,
            {
              borderColor: themeColors.hairline,
              backgroundColor: themeColors.background,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={wallet.icon || 'wallet-outline'}
            size={18}
            color={isNegative ? themeColors.error : themeColors.text}
          />
        </View>

        <View style={styles.metaCol}>
          <Text
            style={[styles.walletName, { color: themeColors.text }]}
            numberOfLines={1}
          >
            {wallet.name}
          </Text>

          <View style={styles.tagRow}>
            {wallet.isDefault && (
              <View
                style={[
                  styles.defaultTag,
                  { borderColor: themeColors.text, backgroundColor: themeColors.text },
                ]}
              >
                <Text style={[styles.defaultTagText, { color: themeColors.background }]}>
                  DEFAULT
                </Text>
              </View>
            )}
            <Text style={[styles.typeLabel, { color: themeColors.textMuted }]}>
              {getWalletTypeLabel()}
            </Text>
          </View>
        </View>
      </View>

      {/* Right: Tabular Balance & Chevron */}
      <View style={styles.rightCol}>
        <View style={styles.balanceContainer}>
          <Text
            style={[
              styles.balanceText,
              {
                color: isNegative ? themeColors.error : themeColors.text,
              },
            ]}
          >
            {formattedBalance}
          </Text>
          {isNegative && (
            <View style={[styles.liabilityIndicator, { backgroundColor: themeColors.error }]} />
          )}
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color={themeColors.textMuted}
          style={styles.chevron}
        />
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: borderRadius.xs, // 2px subtle corner
    marginBottom: 10,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  metaCol: {
    flex: 1,
    justifyContent: 'center',
  },
  walletName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  defaultTag: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 1,
  },
  defaultTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceContainer: {
    alignItems: 'flex-end',
    marginRight: 6,
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  liabilityIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  chevron: {
    marginLeft: 2,
  },
});
