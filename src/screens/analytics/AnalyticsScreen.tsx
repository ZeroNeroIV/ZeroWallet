// Simplizum Analytics Screen — Cash Flow Intelligence, Multi-Horizon Telemetry, and Category Allocation
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { addMonths, subMonths, addQuarters, subQuarters, addYears, subYears } from 'date-fns';
import type { MainStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import {
  AnalyticsService,
  type AnalyticsData,
  type TimeHorizon,
  type CategorySpendItem,
} from '../../services/analyticsService';
import { DualBarHistogram } from '../../components/analytics/DualBarHistogram';
import { CategoryRankedBars } from '../../components/analytics/CategoryRankedBars';
import { CashFlowTrend } from '../../components/dashboard/CashFlowTrend';

type NavProp = StackNavigationProp<MainStackParamList>;

const HORIZONS: Array<{ id: TimeHorizon; label: string }> = [
  { id: 'month', label: 'MONTH' },
  { id: 'quarter', label: 'QUARTER' },
  { id: 'year', label: 'YEAR' },
  { id: 'ytd', label: 'YTD' },
];

export const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { currentAccountId, currentUser } = useAuthStore();
  const themeColors = useThemeColors();

  const [horizon, setHorizon] = useState<TimeHorizon>('month');
  const [dateAnchor, setDateAnchor] = useState<Date>(new Date());
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const analyticsService = useMemo(() => new AnalyticsService(), []);

  const loadData = useCallback(async () => {
    if (!currentAccountId || !currentUser) return;
    try {
      const res = await analyticsService.loadAnalytics(
        currentAccountId,
        currentUser.id,
        horizon,
        dateAnchor
      );
      setData(res);
    } catch (err) {
      console.warn('[AnalyticsScreen] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccountId, currentUser, horizon, dateAnchor, analyticsService]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Date Stepper Navigation (< and >)
  const handleStepDate = (direction: 'prev' | 'next') => {
    triggerHaptic('selection');
    setDateAnchor((prev) => {
      if (horizon === 'quarter') {
        return direction === 'prev' ? subQuarters(prev, 1) : addQuarters(prev, 1);
      }
      if (horizon === 'year') {
        return direction === 'prev' ? subYears(prev, 1) : addYears(prev, 1);
      }
      if (horizon === 'ytd') {
        return direction === 'prev' ? subYears(prev, 1) : addYears(prev, 1);
      }
      return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
    });
  };

  const handleHorizonChange = (newHorizon: TimeHorizon) => {
    triggerHaptic('selection');
    setHorizon(newHorizon);
  };

  // Convert cumulative points for CashFlowTrend component
  const cashFlowTrendPoints = useMemo(() => {
    if (!data?.cumulativePoints) return [];
    return data.cumulativePoints.map((p) => ({
      date: p.date,
      day: p.label,
      value: p.value,
      income: p.inflow,
      expense: p.outflow,
    }));
  }, [data?.cumulativePoints]);

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      {/* 1. Sticky Horizon & Date Stepper Header */}
      <View
        style={[
          styles.stickyHeader,
          {
            backgroundColor: themeColors.surface,
            borderBottomColor: themeColors.hairline,
          },
        ]}
      >
        {/* Horizon Tabs */}
        <View style={styles.horizonTabsRow}>
          {HORIZONS.map((h) => {
            const isSelected = horizon === h.id;
            return (
              <TouchableOpacity
                key={h.id}
                activeOpacity={0.7}
                onPress={() => handleHorizonChange(h.id)}
                style={[
                  styles.horizonTab,
                  {
                    borderColor: isSelected ? themeColors.text : themeColors.hairline,
                    backgroundColor: isSelected ? themeColors.text : themeColors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.horizonTabText,
                    {
                      color: isSelected ? themeColors.background : themeColors.text,
                    },
                  ]}
                >
                  {h.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date Stepper Stepper Row */}
        <View style={styles.dateStepperRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleStepDate('prev')}
            style={[styles.stepperArrow, { borderColor: themeColors.hairline }]}
          >
            <MaterialCommunityIcons name="chevron-left" size={18} color={themeColors.text} />
          </TouchableOpacity>

          <Text style={[styles.periodTitleText, { color: themeColors.text }]}>
            {data?.horizonTitle || 'CURRENT PERIOD'}
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleStepDate('next')}
            style={[styles.stepperArrow, { borderColor: themeColors.hairline }]}
          >
            <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
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
        {loading && !refreshing && !data ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={themeColors.text} size="small" />
          </View>
        ) : data ? (
          <>
            {/* 2. Net Savings Rate KPI Card (User Answer 4) */}
            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.cardBorder,
                },
              ]}
            >
              <View style={styles.kpiTopRow}>
                <Text style={[styles.kpiMicroLabel, { color: themeColors.textMuted }]}>
                  NET SAVINGS RATE
                </Text>

                {/* Delta Badge */}
                <View
                  style={[
                    styles.deltaBadge,
                    {
                      borderColor:
                        data.savingsRateDelta >= 0 ? themeColors.success : themeColors.error,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={data.savingsRateDelta >= 0 ? 'arrow-top-right' : 'arrow-bottom-right'}
                    size={12}
                    color={data.savingsRateDelta >= 0 ? themeColors.success : themeColors.error}
                  />
                  <Text
                    style={[
                      styles.deltaText,
                      {
                        color:
                          data.savingsRateDelta >= 0 ? themeColors.success : themeColors.error,
                      },
                    ]}
                  >
                    {data.savingsRateDelta >= 0 ? '+' : ''}
                    {data.savingsRateDelta.toFixed(1)}% VS PRIOR
                  </Text>
                </View>
              </View>

              <Text style={[styles.kpiRateText, { color: themeColors.text }]}>
                {data.savingsRate.toFixed(1)}%
              </Text>

              {/* 3-Way Metrics Breakdown */}
              <View style={[styles.kpiDivider, { backgroundColor: themeColors.hairline }]} />
              <View style={styles.kpiMetricsRow}>
                <View style={styles.kpiMetricItem}>
                  <Text style={[styles.kpiMetricSub, { color: themeColors.textMuted }]}>
                    INFLOW
                  </Text>
                  <Text style={[styles.kpiMetricVal, { color: themeColors.success }]}>
                    +{formatCurrency(data.inflow, data.currency)}
                  </Text>
                </View>

                <View style={[styles.vertLine, { backgroundColor: themeColors.hairline }]} />

                <View style={styles.kpiMetricItem}>
                  <Text style={[styles.kpiMetricSub, { color: themeColors.textMuted }]}>
                    OUTFLOW
                  </Text>
                  <Text style={[styles.kpiMetricVal, { color: themeColors.text }]}>
                    -{formatCurrency(data.outflow, data.currency)}
                  </Text>
                </View>

                <View style={[styles.vertLine, { backgroundColor: themeColors.hairline }]} />

                <View style={styles.kpiMetricItem}>
                  <Text style={[styles.kpiMetricSub, { color: themeColors.textMuted }]}>
                    SAVED
                  </Text>
                  <Text
                    style={[
                      styles.kpiMetricVal,
                      { color: data.netSavings >= 0 ? themeColors.success : themeColors.error },
                    ]}
                  >
                    {data.netSavings >= 0 ? '+' : ''}
                    {formatCurrency(data.netSavings, data.currency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. Dual-Bar Histogram (User Answer 1) */}
            <DualBarHistogram
              buckets={data.histogramBuckets}
              currency={data.currency}
            />

            {/* 4. Cumulative Net Cash Flow Curve */}
            {cashFlowTrendPoints.length > 0 && (
              <CashFlowTrend
                data={cashFlowTrendPoints}
                netChange={data.netSavings}
                currency={data.currency}
              />
            )}

            {/* 5. Category Spending Allocation (User Answer 3) */}
            <CategoryRankedBars
              items={data.categoryBreakdown}
              currency={data.currency}
              onSelectCategory={(cat) => {
                navigation.navigate('TransactionHistory');
              }}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stickyHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  horizonTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  horizonTab: {
    flex: 1,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizonTabText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dateStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  stepperArrow: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTitleText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerLoading: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  kpiCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 18,
    marginBottom: 16,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kpiMicroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  deltaText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiRateText: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    marginBottom: 14,
  },
  kpiDivider: {
    height: 1,
    marginBottom: 14,
  },
  kpiMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiMetricItem: {
    flex: 1,
  },
  kpiMetricSub: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  kpiMetricVal: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  vertLine: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
});
