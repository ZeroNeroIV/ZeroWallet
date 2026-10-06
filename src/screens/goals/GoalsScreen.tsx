/**
 * Purpose: Financial Horizons & Savings Targets Screen.
 * 
 * Aesthetic: Simplizum
 * - 1px razor hairline outlines
 * - 2-4px subtle corners
 * - Micro-KPI architecture card with master hairline savings burn gauge
 * - Direct Wallet Funding drawer with derived ledger tracking
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { useUIStore } from '../../store/uiStore';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import {
  GoalsDebtsService,
  type GoalsSummary,
} from '../../services/goalsDebtsService';
import { GoalArchitecturalCard } from '../../components/goals/GoalArchitecturalCard';
import { GoalFundModal } from '../../components/goals/GoalFundModal';
import { GoalCompletionModal } from '../../components/goals/GoalCompletionModal';
import type { Goal } from '../../types/models';

type NavigationProp = StackNavigationProp<MainStackParamList, 'GoalsScreen'>;

export default function GoalsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId) || useAccountStore((s) => s.currentAccountId);
  const isBalanceHidden = useUIStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useUIStore((s) => s.toggleBalanceHidden);

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [completedGoals, setCompletedGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalsSummary>({
    totalTarget: 0,
    totalSaved: 0,
    totalRemaining: 0,
    overallPercentage: 0,
    activeCount: 0,
    completedCount: 0,
    currency: 'USD',
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [fundingGoal, setFundingGoal] = useState<Goal | null>(null);
  const [celebrationGoal, setCelebrationGoal] = useState<Goal | null>(null);

  const service = useMemo(() => new GoalsDebtsService(), []);

  const loadData = useCallback(async () => {
    if (!currentAccountId) return;
    try {
      const data = await service.getGoalsData(currentAccountId);
      setActiveGoals(data.activeGoals);
      setCompletedGoals(data.completedGoals);
      setSummary(data.summary);
    } catch (err) {
      console.error('[GoalsScreen] Failed to load goals:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentAccountId, service]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    triggerHaptic('impactLight');
    loadData();
  };

  const handleOpenFund = (goal: Goal) => {
    setFundingGoal(goal);
  };

  const handleOpenEdit = (goal: Goal) => {
    navigation.navigate('EditGoal', { goalId: goal.id });
  };

  const handleConfirmFund = async (params: {
    goalId: string;
    walletId?: string;
    amount: number;
  }) => {
    if (!currentUser || !currentAccountId) return;
    const res = await service.allocateFundsToGoal({
      ...params,
      accountId: currentAccountId,
      userId: currentUser.id,
    });

    await loadData();

    if (res.isReached) {
      setCelebrationGoal(res.goal);
    }
  };

  const displayedGoals = activeTab === 'active' ? activeGoals : completedGoals;

  // Master Hairline Gauge color
  let masterGaugeColor = themeColors.accent;
  if (summary.overallPercentage >= 100) {
    masterGaugeColor = themeColors.success;
  } else if (summary.overallPercentage >= 80) {
    masterGaugeColor = themeColors.warning;
  }

  const cappedPercentage = Math.min(100, Math.max(0, summary.overallPercentage));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={themeColors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
      />

      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: themeColors.borderSubtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerNavButton, { borderColor: themeColors.borderSubtle }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={18} color={themeColors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerSubtitle, { color: themeColors.textMuted }]}>
            FINANCIAL HORIZONS
          </Text>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            Savings & Targets
          </Text>
        </View>

        <View style={styles.headerRightGroup}>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic('selection');
              toggleBalanceHidden();
            }}
            style={[styles.headerNavButton, { borderColor: themeColors.borderSubtle }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Toggle Balance Visibility"
          >
            <Icon
              name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
              size={17}
              color={themeColors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('CreateGoal')}
            style={[
              styles.createButton,
              {
                backgroundColor: themeColors.surfaceElevated,
                borderColor: themeColors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Icon name="plus" size={14} color={themeColors.text} />
            <Text style={[styles.createButtonText, { color: themeColors.text }]}>
              NEW
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.text}
          />
        }
      >
        {/* Micro-KPI Architecture Card */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
        >
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCol}>
              <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                TOTAL TARGET
              </Text>
              <Text style={[styles.kpiValue, { color: themeColors.text }]}>
                {isBalanceHidden ? '••••' : formatCurrency(summary.totalTarget, summary.currency)}
              </Text>
            </View>

            <View
              style={[
                styles.kpiDivider,
                { backgroundColor: themeColors.borderSubtle },
              ]}
            />

            <View style={styles.kpiCol}>
              <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                TOTAL SAVED
              </Text>
              <Text style={[styles.kpiValue, { color: themeColors.success }]}>
                {isBalanceHidden ? '••••' : formatCurrency(summary.totalSaved, summary.currency)}
              </Text>
            </View>

            <View
              style={[
                styles.kpiDivider,
                { backgroundColor: themeColors.borderSubtle },
              ]}
            />

            <View style={styles.kpiCol}>
              <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                REMAINING
              </Text>
              <Text style={[styles.kpiValue, { color: themeColors.accent }]}>
                {isBalanceHidden ? '••••' : formatCurrency(summary.totalRemaining, summary.currency)}
              </Text>
            </View>
          </View>

          {/* Master 2px Hairline Progress Gauge */}
          {summary.totalTarget > 0 && (
            <View style={styles.masterGaugeBlock}>
              <View
                style={[
                  styles.masterGaugeTrack,
                  { backgroundColor: themeColors.borderSubtle },
                ]}
              >
                <View
                  style={[
                    styles.masterGaugeFill,
                    {
                      backgroundColor: masterGaugeColor,
                      width: `${cappedPercentage}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.gaugeMetaRow}>
                <Text style={[styles.gaugeMetaText, { color: themeColors.textMuted }]}>
                  {summary.activeCount} active targets
                </Text>
                <Text style={[styles.gaugeMetaText, { color: masterGaugeColor, fontWeight: typography.weights.bold }]}>
                  {Math.round(summary.overallPercentage)}% SAVED
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 2-Way Segment Tab Switcher */}
        <View
          style={[
            styles.segmentContainer,
            {
              borderColor: themeColors.border,
              backgroundColor: themeColors.surfaceElevated,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'active' && [
                styles.segmentTabActive,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ],
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setActiveTab('active');
            }}
          >
            <Text
              style={[
                styles.segmentTabText,
                {
                  color:
                    activeTab === 'active' ? themeColors.text : themeColors.textMuted,
                  fontWeight:
                    activeTab === 'active'
                      ? typography.weights.bold
                      : typography.weights.medium,
                },
              ]}
            >
              ACTIVE TARGETS ({activeGoals.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'completed' && [
                styles.segmentTabActive,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ],
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setActiveTab('completed');
            }}
          >
            <Text
              style={[
                styles.segmentTabText,
                {
                  color:
                    activeTab === 'completed' ? themeColors.text : themeColors.textMuted,
                  fontWeight:
                    activeTab === 'completed'
                      ? typography.weights.bold
                      : typography.weights.medium,
                },
              ]}
            >
              ACHIEVED ({completedGoals.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Goals List */}
        {displayedGoals.length > 0 ? (
          displayedGoals.map((g) => (
            <GoalArchitecturalCard
              key={g.id}
              goal={g}
              currency={summary.currency}
              onFundPress={handleOpenFund}
              onEditPress={handleOpenEdit}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Icon
              name="flag-outline"
              size={36}
              color={themeColors.textMuted}
              style={{ opacity: 0.5 }}
            />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              {loading
                ? 'Loading targets...'
                : activeTab === 'active'
                ? 'No active savings targets'
                : 'No completed targets yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>
              {activeTab === 'active'
                ? 'Set a financial horizon like buying a vehicle, travel, or an emergency fund.'
                : 'Targets will appear here once you reach 100% of your target savings.'}
            </Text>

            {activeTab === 'active' && (
              <TouchableOpacity
                style={[
                  styles.emptyAddButton,
                  {
                    borderColor: themeColors.border,
                    backgroundColor: themeColors.surfaceElevated,
                  },
                ]}
                onPress={() => navigation.navigate('CreateGoal')}
              >
                <Text style={[styles.emptyAddButtonText, { color: themeColors.text }]}>
                  + SET NEW GOAL
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Direct Wallet Funding Modal */}
      <GoalFundModal
        visible={Boolean(fundingGoal)}
        goal={fundingGoal}
        currency={summary.currency}
        accountId={currentAccountId || ''}
        onClose={() => setFundingGoal(null)}
        onConfirmFund={handleConfirmFund}
      />

      {/* Goal Reached Celebration Modal */}
      <GoalCompletionModal
        visible={Boolean(celebrationGoal)}
        goal={celebrationGoal}
        onClose={() => setCelebrationGoal(null)}
        onMarkComplete={() => setCelebrationGoal(null)}
        onCreateNew={() => {
          setCelebrationGoal(null);
          navigation.navigate('CreateGoal');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerNavButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  createButtonText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  kpiCard: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 28,
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  masterGaugeBlock: {
    marginTop: spacing.md,
    gap: 6,
  },
  masterGaugeTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  masterGaugeFill: {
    height: 2,
    borderRadius: 1,
  },
  gaugeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeMetaText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  segmentContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 2,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.xs,
  },
  segmentTabActive: {
    borderWidth: 1,
  },
  segmentTabText: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },
  emptyAddButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  emptyAddButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
});
