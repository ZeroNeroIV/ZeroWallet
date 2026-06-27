import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_PADDING = spacing.lg * 2;
const VISIBLE_WIDTH = SCREEN_WIDTH - CARD_PADDING - spacing.lg * 2;
const POINT_SPACING = 52; // px per data point — makes chart wide enough to scroll
const CHART_HEIGHT = 110;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const PAD_LEFT = 12;
const PAD_RIGHT = 16;

interface ChartDataPoint {
  day: string;
  income: number;
  expense: number;
}

interface WealthAnalyticsCardProps {
  data: ChartDataPoint[];
  activeTab: 'income' | 'expense' | 'combined';
  onTabChange: (tab: 'income' | 'expense' | 'combined') => void;
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

function buildAreaPath(points: { x: number; y: number }[], baseY: number): string {
  if (points.length < 2) return '';
  const line = buildSmoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}

interface ChartProps {
  values: number[];
  labels: string[];
  lineColor: string;
  gradientId: string;
  gradientColor: string;
  values2?: number[];
  lineColor2?: string;
  gradientId2?: string;
  gradientColor2?: string;
}

const AreaChart: React.FC<ChartProps> = ({
  values, labels, lineColor, gradientId, gradientColor,
  values2, lineColor2, gradientId2, gradientColor2,
}) => {
  const { points, points2, baseY, xPositions, svgWidth } = useMemo(() => {
    const n = values.length;
    const chartW = Math.max(PAD_LEFT + PAD_RIGHT + (n - 1) * POINT_SPACING, VISIBLE_WIDTH);
    const plotW = chartW - PAD_LEFT - PAD_RIGHT;
    const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
    const allVals = values2 ? [...values, ...values2] : values;
    const max = Math.max(...allVals, 1);
    const baseY = PAD_TOP + plotH;

    const xs = values.map((_, i) =>
      PAD_LEFT + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    );
    const toY = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

    const pts = values.map((v, i) => ({ x: xs[i], y: toY(v) }));
    const pts2 = values2 ? values2.map((v, i) => ({ x: xs[i], y: toY(v) })) : undefined;

    return { points: pts, points2: pts2, baseY, xPositions: xs, svgWidth: chartW };
  }, [values, values2]);

  const linePath = buildSmoothPath(points);
  const areaPath = buildAreaPath(points, baseY);
  const linePath2 = points2 ? buildSmoothPath(points2) : null;
  const areaPath2 = points2 ? buildAreaPath(points2, baseY) : null;

  return (
    <Svg width={svgWidth} height={CHART_HEIGHT}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={gradientColor} stopOpacity={0.45} />
          <Stop offset="100%" stopColor={gradientColor} stopOpacity={0} />
        </LinearGradient>
        {gradientId2 && gradientColor2 && (
          <LinearGradient id={gradientId2} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={gradientColor2} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={gradientColor2} stopOpacity={0} />
          </LinearGradient>
        )}
      </Defs>

      {/* Area fill(s) */}
      <Path d={areaPath} fill={`url(#${gradientId})`} />
      {areaPath2 && gradientId2 && (
        <Path d={areaPath2} fill={`url(#${gradientId2})`} />
      )}

      {/* Line(s) */}
      <Path d={linePath} stroke={lineColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {linePath2 && lineColor2 && (
        <Path d={linePath2} stroke={lineColor2} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* X-axis baseline */}
      <Line
        x1={PAD_LEFT} y1={baseY}
        x2={svgWidth - PAD_RIGHT} y2={baseY}
        stroke="rgba(128,128,128,0.2)" strokeWidth={1}
      />

      {/* X-axis labels */}
      {labels.map((label, i) => (
        <SvgText
          key={i}
          x={xPositions[i]}
          y={CHART_HEIGHT - 4}
          fontSize={8}
          fontWeight="700"
          fill="rgba(128,128,128,0.6)"
          textAnchor="middle"
        >
          {label}
        </SvgText>
      ))}
    </Svg>
  );
};

export const WealthAnalyticsCard: React.FC<WealthAnalyticsCardProps> = ({
  data,
  activeTab,
  onTabChange,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const incomeValues = useMemo(() => data.map(d => d.income), [data]);
  const expenseValues = useMemo(() => data.map(d => d.expense), [data]);
  const labels = useMemo(() => data.map(d => d.day.substring(0, 3)), [data]);

  const BLUE = '#4FC3F7';
  const RED = '#EF5350';
  const GREEN = themeColors.goalGreen || '#4CAF50';

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['income', 'expense', 'combined'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'income' ? 'INCOME' : tab === 'expense' ? 'EXPENSES' : 'COMBINED'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.performanceLabel}>PERFORMANCE</Text>
          <Text style={styles.title}>Wealth Analytics</Text>
        </View>
        <View style={styles.headerRight}>
          {activeTab === 'combined' && (
            <View style={styles.legend}>
              <View style={[styles.legendDot, { backgroundColor: BLUE }]} />
              <Text style={styles.legendText}>Income</Text>
              <View style={[styles.legendDot, { backgroundColor: RED }]} />
              <Text style={styles.legendText}>Expense</Text>
            </View>
          )}
          <MaterialCommunityIcons name="finance" size={22} color={themeColors.primary} />
        </View>
      </View>

      {/* Chart — horizontally scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={true}
        style={styles.chartScroll}
        contentContainerStyle={styles.chartContainer}
      >
        {activeTab === 'combined' ? (
          <AreaChart
            key="combined"
            values={incomeValues}
            labels={labels}
            lineColor={BLUE}
            gradientId="incomeGrad"
            gradientColor={BLUE}
            values2={expenseValues}
            lineColor2={RED}
            gradientId2="expenseGrad"
            gradientColor2={RED}
          />
        ) : activeTab === 'income' ? (
          <AreaChart
            key="income"
            values={incomeValues}
            labels={labels}
            lineColor={BLUE}
            gradientId="incomeOnly"
            gradientColor={BLUE}
          />
        ) : (
          <AreaChart
            key="expense"
            values={expenseValues}
            labels={labels}
            lineColor={RED}
            gradientId="expenseOnly"
            gradientColor={RED}
          />
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    backgroundColor: themeColors.glass.background,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: themeColors.glass.border,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: themeColors.isDark
      ? 'rgba(255,255,255,0.05)'
      : 'rgba(0,0,0,0.05)',
    borderRadius: 24,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: themeColors.primary,
    shadowColor: themeColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 9,
    fontWeight: '700',
    color: themeColors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: themeColors.isDark ? themeColors.background : '#1f201f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  performanceLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: themeColors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    ...typography.h4,
    fontSize: 18,
    fontWeight: '700',
    color: themeColors.text,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 9,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  chartScroll: {
    marginTop: spacing.xs,
    marginHorizontal: -spacing.xs,
  },
  chartContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
});
