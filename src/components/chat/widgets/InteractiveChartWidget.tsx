/**
 * InteractiveChartWidget — Generative UI Financial Chart for Chat
 *
 * Renders interactive category donuts, comparison bar charts, and timeline line charts
 * directly within the AI conversational stream using react-native-gifted-charts.
 * Fully responsive: measures container width dynamically via onLayout with zero overflow.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, LayoutChangeEvent } from 'react-native';
import { PieChart, BarChart, LineChart } from 'react-native-gifted-charts';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { lightHaptic } from '../../../services/haptics/hapticFeedback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
}

interface InteractiveChartWidgetProps {
  chartType: 'donut' | 'pie' | 'bar' | 'line';
  title: string;
  data: ChartDataPoint[];
  summary?: string;
  total?: number;
  currency?: string;
}

const FALLBACK_PALETTE = ['#00E5FF', '#7C4DFF', '#00E676', '#FFB300', '#FF5252', '#E040FB', '#40C4FF', '#69F0AE'];

export const InteractiveChartWidget: React.FC<InteractiveChartWidgetProps> = ({
  chartType,
  title,
  data,
  summary,
  total,
  currency = '$',
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - measuredWidth) > 4) {
      setMeasuredWidth(w);
    }
  }, [measuredWidth]);

  // Available inner canvas width strictly bounded to avoid horizontal overflows
  const canvasWidth = useMemo(() => {
    const available = measuredWidth > 0 ? measuredWidth - 28 : SCREEN_WIDTH - 64;
    return Math.max(150, Math.min(available, SCREEN_WIDTH - 64));
  }, [measuredWidth]);

  const calculatedTotal = useMemo(() => {
    if (total !== undefined && total > 0) return total;
    return (data || []).reduce((sum, item) => sum + (item.value || 0), 0);
  }, [total, data]);

  // Donut / Pie Data
  const pieChartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [{ value: 1, color: themeColors.border, text: '' }];
    }
    return data.map((item, idx) => ({
      value: Math.max(0.01, item.value),
      color: item.color || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length],
      text: '',
      focused: selectedIndex === idx,
    }));
  }, [data, selectedIndex, themeColors]);

  // Responsive Bar Data with dynamic bar width and spacing
  const barChartConfig = useMemo(() => {
    const items = data || [];
    const barCount = items.length;
    const availableForBars = canvasWidth - 45;
    const barWidth = Math.max(10, Math.min(20, Math.floor(availableForBars / Math.max(barCount * 1.6, 4))));
    const spacingWidth = Math.max(4, Math.min(14, Math.floor((availableForBars - barWidth * barCount) / Math.max(barCount, 1))));

    const result: any[] = [];
    items.forEach((item, idx) => {
      result.push({
        value: item.value,
        label: item.label.length > 5 ? item.label.substring(0, 4) + '..' : item.label,
        frontColor: item.color || themeColors.primary,
        spacing: item.secondaryValue !== undefined ? 4 : spacingWidth,
        labelTextStyle: { color: themeColors.textSecondary, fontSize: 8 },
      });

      if (item.secondaryValue !== undefined) {
        result.push({
          value: item.secondaryValue,
          frontColor: themeColors.error,
          spacing: spacingWidth,
          labelTextStyle: { color: themeColors.textSecondary, fontSize: 8 },
        });
      }
    });

    return { data: result, barWidth };
  }, [data, canvasWidth, themeColors]);

  // Line Data
  const lineChartData = useMemo(() => {
    return (data || []).map((item) => ({
      value: item.value,
      label: item.label.length > 4 ? item.label.substring(0, 3) + '..' : item.label,
      dataPointText: `${Math.round(item.value)}`,
    }));
  }, [data]);

  const handleSlicePress = (index: number) => {
    lightHaptic();
    setSelectedIndex((prev) => (prev === index ? null : index));
  };

  const selectedItem = selectedIndex !== null && data[selectedIndex] ? data[selectedIndex] : null;

  return (
    <View style={styles.card} onLayout={handleLayout}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons
            name={
              chartType === 'bar'
                ? 'chart-bar'
                : chartType === 'line'
                ? 'chart-timeline-variant'
                : 'chart-arc'
            }
            size={15}
            color={themeColors.primary}
          />
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>

        {calculatedTotal > 0 && (
          <Text style={styles.totalBadge} numberOfLines={1}>
            {calculatedTotal.toFixed(2)} {currency}
          </Text>
        )}
      </View>

      {/* Selected Slice Inspection Pill */}
      {selectedItem && (
        <View style={styles.inspectionPill}>
          <View style={[styles.dot, { backgroundColor: selectedItem.color || themeColors.primary }]} />
          <Text style={styles.inspectionLabel} numberOfLines={1}>{selectedItem.label}:</Text>
          <Text style={styles.inspectionValue} numberOfLines={1}>
            {selectedItem.value.toFixed(2)} {currency} (
            {calculatedTotal > 0 ? ((selectedItem.value / calculatedTotal) * 100).toFixed(1) : 0}%)
          </Text>
        </View>
      )}

      {/* Chart Canvas */}
      <View style={styles.chartCanvas}>
        {chartType === 'donut' || chartType === 'pie' ? (
          <View style={styles.donutRow}>
            <View style={styles.pieWrapper}>
              <PieChart
                data={pieChartData}
                donut={chartType === 'donut'}
                radius={44}
                innerRadius={28}
                isAnimated
                animationDuration={450}
                centerLabelComponent={() => (
                  <View style={styles.centerLabelContainer}>
                    <Text style={styles.centerLabelSuper}>TOTAL</Text>
                    <Text style={styles.centerLabelMain} numberOfLines={1}>
                      {calculatedTotal >= 1000 ? `${(calculatedTotal / 1000).toFixed(1)}k` : calculatedTotal.toFixed(0)}
                    </Text>
                  </View>
                )}
                onPress={(params: any) => {
                  const idx = pieChartData.findIndex((p) => p.value === params.value);
                  if (idx >= 0) handleSlicePress(idx);
                }}
              />
            </View>

            {/* Micro Legend */}
            <View style={styles.legendContainer}>
              {(data || []).slice(0, 5).map((item, idx) => {
                const pct =
                  calculatedTotal > 0
                    ? ((item.value / calculatedTotal) * 100).toFixed(0)
                    : '0';
                const color = item.color || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
                const isSelected = selectedIndex === idx;

                return (
                  <TouchableOpacity
                    key={`${item.label}-${idx}`}
                    style={[styles.legendRow, isSelected && styles.legendRowSelected]}
                    onPress={() => handleSlicePress(idx)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <Text style={styles.legendLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.legendPct}>{pct}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : chartType === 'bar' ? (
          <View style={styles.barContainer}>
            <BarChart
              data={barChartConfig.data}
              width={canvasWidth}
              height={135}
              barWidth={barChartConfig.barWidth}
              isAnimated
              animationDuration={450}
              noOfSections={3}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={themeColors.hairline || themeColors.border}
              yAxisTextStyle={{ color: themeColors.textSecondary, fontSize: 8 }}
              onPress={(_item: any, index: number) => {
                const mappedIdx = Math.floor(index / (data.some((d) => d.secondaryValue) ? 2 : 1));
                if (mappedIdx < data.length) handleSlicePress(mappedIdx);
              }}
            />
          </View>
        ) : (
          <View style={styles.lineContainer}>
            <LineChart
              data={lineChartData}
              width={canvasWidth}
              height={130}
              color={themeColors.primary}
              thickness={2}
              curved
              isAnimated
              animationDuration={450}
              dataPointsColor={themeColors.primary}
              dataPointsRadius={3}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={themeColors.hairline || themeColors.border}
              yAxisTextStyle={{ color: themeColors.textSecondary, fontSize: 8 }}
            />
          </View>
        )}
      </View>

      {/* Summary Footer */}
      {summary && (
        <View style={styles.summaryBox}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={13} color={themeColors.warning} />
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: themeColors.card || themeColors.surface,
      borderColor: themeColors.hairline || themeColors.border,
      borderWidth: 1,
      borderRadius: 4,
      padding: spacing.sm + 4,
      marginVertical: spacing.xs + 2,
      width: '100%',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs + 2,
      gap: spacing.xs,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...typography.caption,
      color: themeColors.text,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.5,
    },
    totalBadge: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 10,
      color: themeColors.primary,
      fontWeight: '700',
      flexShrink: 0,
    },
    inspectionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.background,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 3,
      borderRadius: 3,
      marginBottom: spacing.xs,
      gap: 5,
    },
    inspectionLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 9,
      fontWeight: '600',
      flexShrink: 1,
    },
    inspectionValue: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: themeColors.text,
      fontSize: 9,
      fontWeight: '700',
      flexShrink: 0,
    },
    chartCanvas: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 4,
      width: '100%',
      overflow: 'hidden',
    },
    donutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      gap: 8,
    },
    pieWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    centerLabelContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerLabelSuper: {
      ...typography.caption,
      fontSize: 7,
      color: themeColors.textSecondary,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    centerLabelMain: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 10,
      color: themeColors.text,
      fontWeight: '800',
      maxWidth: 42,
    },
    legendContainer: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 2,
      paddingHorizontal: 4,
      borderRadius: 2,
    },
    legendRowSelected: {
      backgroundColor: themeColors.background,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 4,
      flexShrink: 0,
    },
    legendLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 9,
      flex: 1,
    },
    legendPct: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: themeColors.text,
      fontSize: 9,
      fontWeight: '700',
      marginLeft: 4,
      flexShrink: 0,
    },
    barContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      overflow: 'hidden',
    },
    lineContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      overflow: 'hidden',
    },
    summaryBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.xs,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: themeColors.hairline || themeColors.border,
    },
    summaryText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 10,
      lineHeight: 14,
      flex: 1,
    },
  });
