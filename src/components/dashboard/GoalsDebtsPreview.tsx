// Simplizum Precision — Goals & Debts Financial Horizons Dashboard Card
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { borderRadius } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import type { Goal, Debt } from '../../types/models';
import type { GoalsCount, DebtStat } from '../../services/dashboardService';

interface GoalsDebtsPreviewProps {
  activeGoals: Goal[];
  goalsCount: GoalsCount;
  activeDebts: Debt[];
  debtsStats: DebtStat;
  currency: string;
  isBalanceHidden: boolean;
  onViewAll: () => void;
  onSelectGoals: () => void;
  onSelectDebts: () => void;
}

export const GoalsDebtsPreview: React.FC<GoalsDebtsPreviewProps> = ({
  activeGoals,
  goalsCount,
  activeDebts,
  debtsStats,
  currency,
  isBalanceHidden,
  onViewAll,
  onSelectGoals,
  onSelectDebts,
}) => {
  const themeColors = useThemeColors();

  // Goals math
  const totalSaved = activeGoals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
  const totalTarget = activeGoals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
  const goalsProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  // Debts math
  const totalLent = debtsStats.totalLent || 0;
  const totalBorrowed = debtsStats.totalBorrowed || 0;
  const netDebt = totalLent - totalBorrowed;

  return (
    <View style={styles.container}>
      {/* Editorial Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.superTitle, { color: themeColors.textMuted }]}>
            FINANCIAL HORIZONS
          </Text>
          <Text style={[styles.mainTitle, { color: themeColors.text }]}>
            COMMITMENTS & TARGETS
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            triggerHaptic('selection');
            onViewAll();
          }}
          style={[styles.viewAllBtn, { borderColor: themeColors.hairline }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewAllText, { color: themeColors.text }]}>
            VIEW ALL
          </Text>
          <MaterialCommunityIcons name="arrow-right" size={12} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      {/* Side-by-Side Dual Card Rail */}
      <View style={styles.cardsRow}>
        {/* Card 1: Goals */}
        <TouchableOpacity
          style={[
            styles.metricCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.hairline,
            },
          ]}
          onPress={() => {
            triggerHaptic('selection');
            onSelectGoals();
          }}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={styles.badgeRow}>
              <MaterialCommunityIcons
                name="flag-checkered"
                size={13}
                color={themeColors.goalGreen || themeColors.success}
              />
              <Text style={[styles.cardTitle, { color: themeColors.textMuted }]}>
                SAVINGS
              </Text>
            </View>
            <Text style={[styles.countBadge, { color: themeColors.textMuted }]}>
              {goalsCount.active} ACTIVE
            </Text>
          </View>

          <Text style={[styles.primaryAmount, { color: themeColors.text }]}>
            {isBalanceHidden ? '••••' : formatCurrency(totalSaved, currency)}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={[styles.submetaText, { color: themeColors.textMuted }]}>
              {totalTarget > 0
                ? `${goalsProgress}% of target`
                : `${goalsCount.completed} achieved`}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: themeColors.hairline }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: themeColors.goalGreen || themeColors.success,
                  width: `${goalsProgress}%`,
                },
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* Card 2: Debts */}
        <TouchableOpacity
          style={[
            styles.metricCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.hairline,
            },
          ]}
          onPress={() => {
            triggerHaptic('selection');
            onSelectDebts();
          }}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={styles.badgeRow}>
              <MaterialCommunityIcons
                name="hand-coin-outline"
                size={13}
                color={netDebt >= 0 ? themeColors.success : themeColors.debtRed || themeColors.error}
              />
              <Text style={[styles.cardTitle, { color: themeColors.textMuted }]}>
                NET DEBTS
              </Text>
            </View>
            <Text
              style={[
                styles.countBadge,
                {
                  color: netDebt >= 0 ? themeColors.success : themeColors.debtRed || themeColors.error,
                },
              ]}
            >
              {netDebt >= 0 ? 'RECEIVABLE' : 'PAYABLE'}
            </Text>
          </View>

          <Text
            style={[
              styles.primaryAmount,
              {
                color:
                  netDebt >= 0
                    ? themeColors.success
                    : themeColors.debtRed || themeColors.error,
              },
            ]}
          >
            {isBalanceHidden
              ? '••••'
              : `${netDebt >= 0 ? '+' : ''}${formatCurrency(netDebt, currency)}`}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={[styles.submetaText, { color: themeColors.textMuted }]}>
              {activeDebts.length} active entries
            </Text>
          </View>

          {/* Hairline subtle divider indicator */}
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor:
                  netDebt >= 0
                    ? themeColors.success
                    : themeColors.debtRed || themeColors.error,
              },
            ]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  superTitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  mainTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  viewAllText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  countBadge: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  primaryAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    marginBottom: 6,
  },
  cardFooter: {
    marginBottom: 8,
  },
  submetaText: {
    fontSize: 9.5,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 2,
    width: '100%',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
});
