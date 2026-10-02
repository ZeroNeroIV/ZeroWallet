/**
 * Purpose: Liabilities & Receivables (Debts) Screen.
 * 
 * Aesthetic: Simplizum
 * - 1px razor hairline outlines
 * - 2-4px subtle corners
 * - Micro-KPI architecture card with Net Debt Position (Lent - Borrowed)
 * - Two-sided ledger switcher ('BORROWED (I OWE)' vs 'LENT (OWED TO ME)')
 * - One-tap payment logging modal with direct wallet ledger tracking
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
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import {
  GoalsDebtsService,
  type DebtsSummary,
} from '../../services/goalsDebtsService';
import { DebtArchitecturalCard } from '../../components/debts/DebtArchitecturalCard';
import { DebtPaymentModal } from '../../components/debts/DebtPaymentModal';
import type { Debt } from '../../types/models';

type NavigationProp = StackNavigationProp<MainStackParamList>;

export default function DebtsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId) || useAccountStore((s) => s.currentAccountId);

  const [activeTab, setActiveTab] = useState<'borrowed' | 'lent'>('borrowed');
  const [borrowedDebts, setBorrowedDebts] = useState<Debt[]>([]);
  const [lentDebts, setLentDebts] = useState<Debt[]>([]);
  const [summary, setSummary] = useState<DebtsSummary>({
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
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);

  const service = useMemo(() => new GoalsDebtsService(), []);

  const loadData = useCallback(async () => {
    if (!currentAccountId) return;
    try {
      const data = await service.getDebtsData(currentAccountId);
      setBorrowedDebts(data.borrowedDebts);
      setLentDebts(data.lentDebts);
      setSummary(data.summary);
    } catch (err) {
      console.error('[DebtsScreen] Failed to load debts:', err);
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

  const handleOpenAdd = () => {
    triggerHaptic('selection');
    navigation.navigate('AddDebt', { type: activeTab });
  };

  const handleOpenPayment = (debt: Debt) => {
    setPayingDebt(debt);
  };

  const handleConfirmPayment = async (params: {
    debtId: string;
    walletId?: string;
    amount: number;
  }) => {
    if (!currentUser || !currentAccountId) return;
    await service.recordDebtPayment({
      ...params,
      accountId: currentAccountId,
      userId: currentUser.id,
    });
    await loadData();
  };

  const handleDebtPress = (debt: Debt) => {
    navigation.navigate('DebtDetails', { debtId: debt.id });
  };

  const displayedDebts = activeTab === 'borrowed' ? borrowedDebts : lentDebts;

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
            LIABILITIES & RECEIVABLES
          </Text>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            Debts & Loans
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleOpenAdd}
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
        {/* Net Debt Position Micro-KPI Card */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
        >
          <View style={styles.netPositionHeader}>
            <View>
              <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                NET DEBT POSITION (LENT - BORROWED)
              </Text>
              <Text
                style={[
                  styles.netPositionValue,
                  {
                    color:
                      summary.netPosition > 0
                        ? themeColors.success
                        : summary.netPosition < 0
                        ? themeColors.error
                        : themeColors.text,
                  },
                ]}
              >
                {summary.netPosition >= 0 ? '+' : ''}
                {formatCurrency(summary.netPosition, summary.currency)}
              </Text>
            </View>

            {summary.overdueCount > 0 && (
              <View
                style={[
                  styles.overdueBadge,
                  {
                    borderColor: themeColors.error,
                    backgroundColor: `${themeColors.error}15`,
                  },
                ]}
              >
                <Icon name="alert-circle-outline" size={12} color={themeColors.error} />
                <Text style={[styles.overdueBadgeText, { color: themeColors.error }]}>
                  {summary.overdueCount} OVERDUE
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.kpiDividerHorizontal, { backgroundColor: themeColors.borderSubtle }]} />

          <View style={styles.kpiGrid}>
            <View style={styles.kpiCol}>
              <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                I OWE (BORROWED)
              </Text>
              <Text style={[styles.kpiValue, { color: themeColors.error }]}>
                {formatCurrency(summary.totalBorrowedOutstanding, summary.currency)}
              </Text>
              <Text style={[styles.kpiSubmeta, { color: themeColors.textMuted }]}>
                {summary.pendingBorrowedCount} active obligations
              </Text>
            </View>

            <View
              style={[
                styles.kpiDividerVertical,
                { backgroundColor: themeColors.borderSubtle },
              ]}
            />

            <View style={styles.kpiCol}>
              <Text style={[styles.kpiLabel, { color: themeColors.textMuted }]}>
                OWED TO ME (LENT)
              </Text>
              <Text style={[styles.kpiValue, { color: themeColors.success }]}>
                {formatCurrency(summary.totalLentOutstanding, summary.currency)}
              </Text>
              <Text style={[styles.kpiSubmeta, { color: themeColors.textMuted }]}>
                {summary.pendingLentCount} active receivables
              </Text>
            </View>
          </View>
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
              activeTab === 'borrowed' && [
                styles.segmentTabActive,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ],
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setActiveTab('borrowed');
            }}
          >
            <Text
              style={[
                styles.segmentTabText,
                {
                  color:
                    activeTab === 'borrowed'
                      ? themeColors.text
                      : themeColors.textMuted,
                  fontWeight:
                    activeTab === 'borrowed'
                      ? typography.weights.bold
                      : typography.weights.medium,
                },
              ]}
            >
              BORROWED / I OWE ({borrowedDebts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeTab === 'lent' && [
                styles.segmentTabActive,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.border,
                },
              ],
            ]}
            onPress={() => {
              triggerHaptic('selection');
              setActiveTab('lent');
            }}
          >
            <Text
              style={[
                styles.segmentTabText,
                {
                  color:
                    activeTab === 'lent'
                      ? themeColors.text
                      : themeColors.textMuted,
                  fontWeight:
                    activeTab === 'lent'
                      ? typography.weights.bold
                      : typography.weights.medium,
                },
              ]}
            >
              LENT / OWED TO ME ({lentDebts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Debts List */}
        {displayedDebts.length > 0 ? (
          displayedDebts.map((d) => (
            <DebtArchitecturalCard
              key={d.id}
              debt={d}
              currency={summary.currency}
              onPaymentPress={handleOpenPayment}
              onPress={handleDebtPress}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Icon
              name="handshake-outline"
              size={36}
              color={themeColors.textMuted}
              style={{ opacity: 0.5 }}
            />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              {loading
                ? 'Loading records...'
                : activeTab === 'borrowed'
                ? 'No money borrowed'
                : 'No money lent out'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>
              {activeTab === 'borrowed'
                ? 'Log liabilities and loans you owe to others with due dates and payment tracking.'
                : 'Record money you have lent to friends, family, or clients.'}
            </Text>

            <TouchableOpacity
              style={[
                styles.emptyAddButton,
                {
                  borderColor: themeColors.border,
                  backgroundColor: themeColors.surfaceElevated,
                },
              ]}
              onPress={handleOpenAdd}
            >
              <Text style={[styles.emptyAddButtonText, { color: themeColors.text }]}>
                + RECORD {activeTab === 'borrowed' ? 'BORROWED MONEY' : 'LENT MONEY'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Payment Logging Modal */}
      <DebtPaymentModal
        visible={Boolean(payingDebt)}
        debt={payingDebt}
        currency={summary.currency}
        accountId={currentAccountId || ''}
        onClose={() => setPayingDebt(null)}
        onConfirmPayment={handleConfirmPayment}
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
  netPositionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  netPositionValue: {
    fontSize: 20,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: borderRadius.none,
  },
  overdueBadgeText: {
    fontSize: 8,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  kpiDividerHorizontal: {
    height: 1,
    marginVertical: spacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiCol: {
    flex: 1,
  },
  kpiDividerVertical: {
    width: 1,
    height: 36,
    marginHorizontal: spacing.md,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  kpiSubmeta: {
    fontSize: 10,
    marginTop: 2,
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
    letterSpacing: 0.5,
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
