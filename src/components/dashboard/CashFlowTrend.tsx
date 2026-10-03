// Simplizum Cash Flow Trend — Hairline 30-Day Line Chart with interactive scrub
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, PanResponder } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import type { CashFlow30DayPoint } from '../../services/dashboardService';

interface CashFlowTrendProps {
  data?: CashFlow30DayPoint[];
  netChange?: number;
  currency: string;
  isBalanceHidden?: boolean;
}

export const CashFlowTrend: React.FC<CashFlowTrendProps> = ({
  data = [],
  netChange = 0,
  currency,
  isBalanceHidden = false,
}) => {
  const themeColors = useThemeColors();
  const [chartWidth, setChartWidth] = useState(300);
  const chartHeight = 120;
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - chartWidth) > 2) {
      setChartWidth(w);
    }
  };

  // Determine min and max values for scaling
  const { minVal, maxVal, pathD, points, zeroY } = useMemo(() => {
    if (!data || data.length === 0) {
      return { minVal: 0, maxVal: 100, pathD: '', points: [], zeroY: chartHeight / 2 };
    }

    const values = data.map((d) => d.value);
    let min = Math.min(...values);
    let max = Math.max(...values);

    // Ensure there is some range so it doesn't divide by zero
    if (min === max) {
      min = min - 10;
      max = max + 10;
    }

    // Add padding to range
    const range = max - min;
    const paddedMin = min - range * 0.15;
    const paddedMax = max + range * 0.15;
    const effectiveRange = paddedMax - paddedMin;

    const paddingX = 10;
    const availableWidth = Math.max(chartWidth - paddingX * 2, 10);
    const stepX = availableWidth / (data.length - 1 || 1);

    const pts: { x: number; y: number }[] = [];
    let d = '';

    data.forEach((item, idx) => {
      const x = paddingX + idx * stepX;
      const normalizedY = (item.value - paddedMin) / effectiveRange;
      const y = chartHeight - (normalizedY * chartHeight);
      pts.push({ x, y });

      if (idx === 0) {
        d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });

    const zeroNorm = (0 - paddedMin) / effectiveRange;
    const zeroLineY = Math.max(0, Math.min(chartHeight, chartHeight - (zeroNorm * chartHeight)));

    return { minVal: min, maxVal: max, pathD: d, points: pts, zeroY: zeroLineY };
  }, [data, chartWidth]);

  // Touch pan responder for scrub interaction
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          triggerHaptic('selection');
          updateScrub(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          updateScrub(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          setScrubIndex(null);
        },
        onPanResponderTerminate: () => {
          setScrubIndex(null);
        },
      }),
    [points, data]
  );

  const updateScrub = (touchX: number) => {
    if (!points || points.length === 0) return;
    let closestIdx = 0;
    let minDiff = Infinity;
    points.forEach((pt, idx) => {
      const diff = Math.abs(pt.x - touchX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setScrubIndex(closestIdx);
  };

  const activePoint = scrubIndex !== null && data[scrubIndex] ? data[scrubIndex] : null;
  const activeCoordinates = scrubIndex !== null && points[scrubIndex] ? points[scrubIndex] : null;

  const displayAmount = activePoint
    ? activePoint.value
    : netChange;

  const displayDate = activePoint
    ? activePoint.day.toUpperCase()
    : 'PAST 30 DAYS NET';

  const isPositive = displayAmount >= 0;
  const formattedAmount = isBalanceHidden
    ? '••••'
    : `${isPositive ? '+' : ''}${formatCurrency(displayAmount, currency)}`;

  return (
    <View style={styles.outerContainer}>
      <View
        style={[
          styles.container,
          {
            borderColor: themeColors.hairline,
            backgroundColor: themeColors.card,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>
              CASH FLOW TREND
            </Text>
            <Text style={[styles.dateSubtitle, { color: themeColors.textSecondary }]}>
              {displayDate}
            </Text>
          </View>

          <Text
            style={[
              styles.netChangeText,
              { color: isPositive ? themeColors.success : themeColors.error },
            ]}
          >
            {formattedAmount}
          </Text>
        </View>

        {/* SVG Chart Area */}
        <View
          style={styles.svgWrapper}
          onLayout={onLayout}
          {...panResponder.panHandlers}
        >
          {pathD ? (
            <Svg width={chartWidth} height={chartHeight}>
              {/* Zero baseline */}
              <Line
                x1={0}
                y1={zeroY}
                x2={chartWidth}
                y2={zeroY}
                stroke={themeColors.hairline}
                strokeWidth={1}
                strokeDasharray="4, 4"
              />

              {/* Main Hairline Trend Line */}
              <Path
                d={pathD}
                fill="none"
                stroke={themeColors.primary}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Active Scrubber Indicator */}
              {activeCoordinates && (
                <>
                  <Line
                    x1={activeCoordinates.x}
                    y1={0}
                    x2={activeCoordinates.x}
                    y2={chartHeight}
                    stroke={themeColors.textMuted}
                    strokeWidth={1}
                    strokeDasharray="2, 2"
                  />
                  <Circle
                    cx={activeCoordinates.x}
                    cy={activeCoordinates.y}
                    r={4}
                    fill={themeColors.primary}
                    stroke={themeColors.card}
                    strokeWidth={2}
                  />
                </>
              )}
            </Svg>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                No transaction trend data yet
              </Text>
            </View>
          )}
        </View>

        {/* Chart Footer with 30-day start and end labels */}
        <View style={styles.chartFooter}>
          <Text style={[styles.footerDate, { color: themeColors.textMuted }]}>
            {data[0]?.day || '30 days ago'}
          </Text>
          <Text style={[styles.footerDate, { color: themeColors.textMuted }]}>
            Today
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  container: {
    borderRadius: 4,
    borderWidth: 1,
    padding: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  dateSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  netChangeText: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  svgWrapper: {
    height: 120,
    justifyContent: 'center',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 6,
  },
  footerDate: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
