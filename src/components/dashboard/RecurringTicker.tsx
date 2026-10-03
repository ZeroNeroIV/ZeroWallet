// Simplizum Recurring Ticker — Slim 1-line upcoming commitment ticker
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import type { UpcomingRecurringItem } from '../../services/dashboardService';

interface RecurringTickerProps {
  item?: UpcomingRecurringItem | null;
  currency: string;
  onPress: () => void;
  isBalanceHidden?: boolean;
}

export const RecurringTicker: React.FC<RecurringTickerProps> = ({
  item,
  currency,
  onPress,
  isBalanceHidden = false,
}) => {
  const themeColors = useThemeColors();

  if (!item) {
    return null;
  }

  const daysLabel =
    item.daysUntil === 0
      ? 'due today'
      : item.daysUntil === 1
      ? 'due tomorrow'
      : `in ${item.daysUntil} days`;

  const amountStr = isBalanceHidden ? '••••' : formatCurrency(item.amount, currency);

  return (
    <View style={styles.outerContainer}>
      <TouchableOpacity
        style={[
          styles.container,
          {
            borderColor: themeColors.hairline,
            backgroundColor: themeColors.card,
          },
        ]}
        onPress={() => {
          triggerHaptic('selection');
          onPress();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.leftGroup}>
          <MaterialCommunityIcons
            name="calendar-clock-outline"
            size={15}
            color={themeColors.textMuted}
          />
          <Text style={[styles.tickerText, { color: themeColors.text }]} numberOfLines={1}>
            <Text style={styles.prefix}>NEXT DUE: </Text>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.amount}> ({amountStr}) </Text>
            <Text style={[styles.days, { color: themeColors.textSecondary }]}>• {daysLabel}</Text>
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={16}
          color={themeColors.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 6,
  },
  tickerText: {
    fontSize: 12,
    flex: 1,
  },
  prefix: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  name: {
    fontWeight: '600',
  },
  amount: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  days: {
    fontSize: 11,
  },
});
