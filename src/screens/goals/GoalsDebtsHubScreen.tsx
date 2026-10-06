/**
 * Purpose: Unified Financial Horizons & Commitments Screen (Goals & Debts Hub).
 * 
 * Aesthetic: Simplizum
 * - 1px razor hairline borders and subtle radii
 * - Micro-KPI architecture banner with Net Debt Position and Savings Horizon gauges
 * - Instant toggleable Segmented Rail: 'SAVINGS GOALS' vs 'DEBTS & LIABILITIES'
 * - Global eye-toggle persistence integration with maskable tabular figures
 * - Fast drawer modals for funding goals and settling debts directly via wallet balances
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  type DebtsSummary,
} from '../../services/goalsDebtsService';
import { GoalArchitecturalCard } from '../../components/goals/GoalArchitecturalCard';
import { GoalFundModal } from '../../components/goals/GoalFundModal';
import { GoalCompletionModal } from '../../components/goals/GoalCompletionModal';
import { DebtArchitecturalCard } from '../../components/debts/DebtArchitecturalCard';
import { DebtPaymentModal } from '../../components/debts/DebtPaymentModal';
import type { Goal, Debt } from '../../types/models';

type Nav = StackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'GoalsDebtsHub'>;

type MainTab = 'goals' | 'debts';
type GoalsFilter = 'active' | 'completed';
type DebtsFilter = 'borrowed' | 'lent';

export const GoalsDebtsHubScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId =
    useAuthStore((s) => s.currentAccountId) || useAccountStore((s) => s.currentAccountId);
  const isBalanceHidden = useUIStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useUIStore((s) => s.toggleBalanceHidden);

  // Tabs
  const [mainTab, setMainTab] = useState<MainTab>(
    route.params?.initialTab === 'debts' ? 'debts' : 'goals'
  );
  const [goalsFilter, setGoalsFilter] = useState<GoalsFilter>('active');
  const [debtsFilter, setDebtsFilter] = useState<DebtsFilter>('borrowed');

  // Data states
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [completedGoals, setCompletedGoals] = useState<Goal[]>([]);
  const [goalsSummary, setGoalsSummary] = useState<GoalsSummary>({
    totalTarget: 0,
    totalSaved: 0,
    totalRemaining: 0,
    overallPercentage: 0,
    activeCount: 0,
    completedCount: 0,
    currency: 'USD',
  });

  const [borrowedDebts, setBorrowedDebts] = useState<Debt[]>([]);
  const [lentDebts, setLentDebts] = useState<Debt[]>([]);
  const [debtsSummary, setDebtsSummary] = useState<DebtsSummary>({
    totalLentOutstanding: 0,
    totalBorrowedOutstanding: 0,
    netPosition: 0,
    overdueCount: 0,
    pendingLentCount: 0,
    pendingBorrowedCount: 0,
    currency: 'USD',
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [fundingGoal, setFundingGoal] = useState<Goal | null>(null);
  const [celebrationGoal, setCelebrationGoal] = useState<Goal | null>(null);
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);

  const service = useMemo(() => new GoalsDebtsService(), []);

  const loadData = useCallback(async () => {
    if (!currentAccountId) return;
    try {
      const [goalsData, debtsData] = await Promise.all([
        service.getGoalsData(currentAccountId),
        service.getDebtsData(currentAccountId),
      ]);

      setActiveGoals(goalsData.activeGoals);
      setCompletedGoals(goalsData.completedGoals);
      setGoalsSummary(goalsData.summary);

      setBorrowedDebts(debtsData.borrowedDebts);
      setLentDebts(debtsData.lentDebts);
      setDebtsSummary(debtsData.summary);
    } catch (err) {
      console.warn('[GoalsDebtsHub] loadData error:', err);
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

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    triggerHaptic('impactLight');
    loadData();
  }, [loadData]);

  // Primary Add Action
  const handleAddPress = useCallback(() => {
    triggerHaptic('selection');
    if (mainTab === 'goals') {
      navigation.navigate('CreateGoal');
    } else {
      navigation.navigate('AddDebt', { type: debtsFilter });
    }
  }, [mainTab, debtsFilter, navigation]);

  // Goal funding
  const handleConfirmFundGoal = async (params: {
    goalId: string;
    walletId?: string;
    amount: number;
  }) => {
    if (!currentAccountId || !currentUser) return;
    try {
      const result = await service.allocateFundsToGoal({
        ...params,
        accountId: currentAccountId,
        userId: currentUser.id,
      });
      setFundingGoal(null);
      await loadData();
      if (result.isReached) {
        setCelebrationGoal(result.goal);
      }
    } catch (err: any) {
      Alert.alert('Funding Error', err?.message || 'Could not fund goal');
    }
  };

  // Debt payment
  const handleConfirmPayDebt = async (params: {
    debtId: string;
    walletId?: string;
    amount: number;
  }) => {
    if (!currentAccountId || !currentUser) return;
    try {
      await service.recordDebtPayment({
        ...params,
        accountId: currentAccountId,
        userId: currentUser.id,
      });
      setPayingDebt(null);
      await loadData();
    } catch (err: any) {
      Alert.alert('Payment Error', err?.message || 'Could not record payment');
    }
  };

  const currency = goalsSummary.currency || debtsSummary.currency || 'USD';
  const displayedGoals = goalsFilter === 'active' ? activeGoals : completedGoals;
  const displayedDebts = debtsFilter === 'borrowed' ? borrowedDebts : lentDebts;

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={themeColors.isDark ? 'light-content' : 'dark-content'} />

      {/* Top Precision Command Header */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: themeColors.hairline,
            backgroundColor: themeColors.background,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('impactLight');
                navigation.goBack();
              }}
              style={[
                styles.headerBackBtn,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.surface,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Back"
            >
              <Icon name="arrow-left" size={18} color={themeColors.text} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={[styles.headerSuper, { color: themeColors.textMuted }]}>
              ZERO WALLET · COMMITMENTS
            </Text>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>
              GOALS & DEBTS
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              {
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.surface,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              toggleBalanceHidden();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityLabel="Toggle Number Visibility"
          >
            <Icon
              name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={themeColors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              styles.headerAddBtn,
              {
                borderColor: themeColors.primary,
                backgroundColor: themeColors.primary,
              },
            ]}
            onPress={handleAddPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
            accessibilityLabel={mainTab === 'goals' ? 'Add Goal' : 'Add Debt'}
          >
            <Icon name="plus" size={18} color={themeColors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
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
        {/* Architectural KPI Summary Cards */}
        <View style={styles.kpiContainer}>
          {/* Card 1: Goals Horizon */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic('selection');
              setMainTab('goals');
            }}
            style={[
              styles.kpiCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: mainTab === 'goals' ? themeColors.text : themeColors.hairline,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiTitle, { color: themeColors.textMuted }]}>
                SAVINGS GOALS
              </Text>
              <View
                style={[
                  styles.kpiBadge,
                  {
                    backgroundColor: `${themeColors.success}15`,
                    borderColor: themeColors.success,
                  },
                ]}
              >
                <Text style={[styles.kpiBadgeText, { color: themeColors.success }]}>
                  {goalsSummary.activeCount} ACTIVE
                </Text>
              </View>
            </View>

            <Text style={[styles.kpiValue, { color: themeColors.text }]}>
              {isBalanceHidden
                ? '••••'
                : formatCurrency(goalsSummary.totalSaved, currency)}
            </Text>

            <View style={styles.kpiFooter}>
              <Text style={[styles.kpiSubtext, { color: themeColors.textMuted }]}>
                Target: {isBalanceHidden ? '••••' : formatCurrency(goalsSummary.totalTarget, currency)}
              </Text>
              <Text style={[styles.kpiPercent, { color: themeColors.success }]}>
                {Math.round(goalsSummary.overallPercentage)}%
              </Text>
            </View>

            {/* Hairline progress bar */}
            <View style={[styles.kpiBarTrack, { backgroundColor: themeColors.hairline }]}>
              <View
                style={[
                  styles.kpiBarFill,
                  {
                    backgroundColor: themeColors.success,
                    width: `${Math.min(100, Math.max(0, goalsSummary.overallPercentage))}%`,
                  },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* Card 2: Net Debt Position */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              triggerHaptic('selection');
              setMainTab('debts');
            }}
            style={[
              styles.kpiCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: mainTab === 'debts' ? themeColors.text : themeColors.hairline,
              },
            ]}
          >
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiTitle, { color: themeColors.textMuted }]}>
                NET DEBT POSITION
              </Text>
              <View
                style={[
                  styles.kpiBadge,
                  {
                    backgroundColor:
                      debtsSummary.netPosition >= 0
                        ? `${themeColors.success}15`
                        : `${themeColors.error}15`,
                    borderColor:
                      debtsSummary.netPosition >= 0
                        ? themeColors.success
                        : themeColors.error,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.kpiBadgeText,
                    {
                      color:
                        debtsSummary.netPosition >= 0
                          ? themeColors.success
                          : themeColors.error,
                    },
                  ]}
                >
                  {debtsSummary.netPosition >= 0 ? 'CREDITOR' : 'DEBTOR'}
                </Text>
              </View>
            </View>

            <Text
              style={[
                styles.kpiValue,
                {
                  color:
                    debtsSummary.netPosition >= 0
                      ? themeColors.success
                      : themeColors.error,
                },
              ]}
            >
              {isBalanceHidden
                ? '••••'
                : `${debtsSummary.netPosition >= 0 ? '+' : ''}${formatCurrency(
                    debtsSummary.netPosition,
                    currency
                  )}`}
            </Text>

            <View style={styles.kpiFooter}>
              <Text style={[styles.kpiSubtext, { color: themeColors.textMuted }]}>
                Lent: {isBalanceHidden ? '••••' : formatCurrency(debtsSummary.totalLentOutstanding, currency)}
              </Text>
              <Text style={[styles.kpiSubtext, { color: themeColors.textMuted }]}>
                Owe: {isBalanceHidden ? '••••' : formatCurrency(debtsSummary.totalBorrowedOutstanding, currency)}
              </Text>
            </View>

            {/* Overdue alert indicator */}
            {debtsSummary.overdueCount > 0 ? (
              <View style={styles.overdueAlertRow}>
                <Icon name="alert-circle-outline" size={11} color={themeColors.error} />
                <Text style={[styles.overdueAlertText, { color: themeColors.error }]}>
                  {debtsSummary.overdueCount} OVERDUE COMMITMENTS
                </Text>
              </View>
            ) : (
              <View style={styles.overdueAlertRow}>
                <Icon name="check-circle-outline" size={11} color={themeColors.success} />
                <Text style={[styles.overdueAlertText, { color: themeColors.textMuted }]}>
                  ALL SETTLEMENTS CURRENT
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Primary Segmented Rail */}
        <View
          style={[
            styles.segmentedRail,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.hairline,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.segmentedTab,
              mainTab === 'goals' && {
                backgroundColor: themeColors.text,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setMainTab('goals');
            }}
            activeOpacity={0.8}
          >
            <Icon
              name="flag-checkered"
              size={14}
              color={mainTab === 'goals' ? themeColors.background : themeColors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentedTabText,
                {
                  color: mainTab === 'goals' ? themeColors.background : themeColors.text,
                },
              ]}
            >
              SAVINGS GOALS ({goalsSummary.activeCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentedTab,
              mainTab === 'debts' && {
                backgroundColor: themeColors.text,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setMainTab('debts');
            }}
            activeOpacity={0.8}
          >
            <Icon
              name="hand-coin-outline"
              size={14}
              color={mainTab === 'debts' ? themeColors.background : themeColors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentedTabText,
                {
                  color: mainTab === 'debts' ? themeColors.background : themeColors.text,
                },
              ]}
            >
              DEBTS ({debtsSummary.pendingBorrowedCount + debtsSummary.pendingLentCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sub-Filter Chips */}
        {mainTab === 'goals' ? (
          <View style={styles.subFilterRow}>
            {(['active', 'completed'] as GoalsFilter[]).map((gf) => {
              const isSelected = goalsFilter === gf;
              const count = gf === 'active' ? goalsSummary.activeCount : goalsSummary.completedCount;
              return (
                <TouchableOpacity
                  key={gf}
                  onPress={() => {
                    triggerHaptic('selection');
                    setGoalsFilter(gf);
                  }}
                  style={[
                    styles.subFilterChip,
                    {
                      borderColor: isSelected ? themeColors.text : themeColors.hairline,
                      backgroundColor: isSelected ? themeColors.text : themeColors.surface,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.subFilterChipText,
                      {
                        color: isSelected ? themeColors.background : themeColors.text,
                      },
                    ]}
                  >
                    {gf.toUpperCase()} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.subFilterRow}>
            {(['borrowed', 'lent'] as DebtsFilter[]).map((df) => {
              const isSelected = debtsFilter === df;
              const label = df === 'borrowed' ? 'I OWE (BORROWED)' : 'OWED TO ME (LENT)';
              const count = df === 'borrowed' ? debtsSummary.pendingBorrowedCount : debtsSummary.pendingLentCount;
              return (
                <TouchableOpacity
                  key={df}
                  onPress={() => {
                    triggerHaptic('selection');
                    setDebtsFilter(df);
                  }}
                  style={[
                    styles.subFilterChip,
                    {
                      borderColor: isSelected ? themeColors.text : themeColors.hairline,
                      backgroundColor: isSelected ? themeColors.text : themeColors.surface,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.subFilterChipText,
                      {
                        color: isSelected ? themeColors.background : themeColors.text,
                      },
                    ]}
                  >
                    {label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Content Section */}
        {mainTab === 'goals' ? (
          displayedGoals.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.hairline,
                },
              ]}
            >
              <Icon name="flag-outline" size={32} color={themeColors.textMuted} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
                {goalsFilter === 'active' ? 'No Active Goals' : 'No Completed Goals Yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>
                {goalsFilter === 'active'
                  ? 'Define targets for vacations, emergency buffers, or investments.'
                  : 'Reach 100% of your targets to archive your completed milestones.'}
              </Text>
              {goalsFilter === 'active' && (
                <TouchableOpacity
                  style={[
                    styles.emptyCtaBtn,
                    {
                      backgroundColor: themeColors.primary,
                      borderColor: themeColors.primary,
                    },
                  ]}
                  onPress={() => navigation.navigate('CreateGoal')}
                  activeOpacity={0.8}
                >
                  <Icon name="plus" size={14} color={themeColors.onPrimary} />
                  <Text style={[styles.emptyCtaText, { color: themeColors.onPrimary }]}>
                    CREATE FIRST GOAL
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.cardList}>
              {displayedGoals.map((goal) => (
                <GoalArchitecturalCard
                  key={goal.id}
                  goal={goal}
                  currency={currency}
                  onFundPress={(g) => setFundingGoal(g)}
                  onEditPress={(g) => navigation.navigate('CreateGoal', { goalId: g.id })}
                />
              ))}
            </View>
          )
        ) : displayedDebts.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.hairline,
              },
            ]}
          >
            <Icon name="hand-coin-outline" size={32} color={themeColors.textMuted} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              {debtsFilter === 'borrowed'
                ? 'No Outstanding Liabilities'
                : 'No Receivables Owed to You'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>
              {debtsFilter === 'borrowed'
                ? 'You do not owe money to anyone right now. Clean ledger.'
                : 'Log personal loans, shared tabs, or advances given to friends.'}
            </Text>
            <TouchableOpacity
              style={[
                styles.emptyCtaBtn,
                {
                  backgroundColor: themeColors.primary,
                  borderColor: themeColors.primary,
                },
              ]}
              onPress={() => navigation.navigate('AddDebt', { type: debtsFilter })}
              activeOpacity={0.8}
            >
              <Icon name="plus" size={14} color={themeColors.onPrimary} />
              <Text style={[styles.emptyCtaText, { color: themeColors.onPrimary }]}>
                {debtsFilter === 'borrowed' ? 'LOG BORROWED DEBT' : 'LOG LENT MONEY'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardList}>
            {displayedDebts.map((debt) => (
              <DebtArchitecturalCard
                key={debt.id}
                debt={debt}
                currency={currency}
                onPaymentPress={(d) => setPayingDebt(d)}
                onPress={(d) => navigation.navigate('DebtDetails', { debtId: d.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Goal Funding Modal */}
      {currentAccountId && (
        <GoalFundModal
          visible={Boolean(fundingGoal)}
          goal={fundingGoal}
          currency={currency}
          accountId={currentAccountId}
          onClose={() => setFundingGoal(null)}
          onConfirmFund={handleConfirmFundGoal}
        />
      )}

      {/* Goal Completion Celebration Modal */}
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

      {/* Debt Payment Modal */}
      {currentAccountId && (
        <DebtPaymentModal
          visible={Boolean(payingDebt)}
          debt={payingDebt}
          currency={currency}
          accountId={currentAccountId}
          onClose={() => setPayingDebt(null)}
          onConfirmPayment={handleConfirmPayDebt}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSuper: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddBtn: {
    borderWidth: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 12,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiTitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  kpiBadge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  kpiBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    marginBottom: 6,
  },
  kpiFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiSubtext: {
    fontSize: 9.5,
    fontVariant: ['tabular-nums'],
  },
  kpiPercent: {
    fontSize: 10,
    fontWeight: '700',
  },
  kpiBarTrack: {
    height: 2,
    width: '100%',
    borderRadius: 1,
    overflow: 'hidden',
  },
  kpiBarFill: {
    height: 2,
    borderRadius: 1,
  },
  overdueAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  overdueAlertText: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  segmentedRail: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 3,
    marginBottom: 12,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 2,
  },
  segmentedTabText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  subFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  subFilterChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  subFilterChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardList: {
    gap: 10,
  },
  emptyCard: {
    padding: 28,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 240,
    marginBottom: 16,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
  },
  emptyCtaText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
