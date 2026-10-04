/**
 * InteractiveChartWidget — Generative UI Financial Chart for Chat
 *
 * Renders interactive category donuts, comparison bar charts, and timeline line charts
 * directly within the AI conversational stream using react-native-gifted-charts.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { PieChart, BarChart, LineChart } from 'react-native-gifted-charts';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { lightHaptic } from '../../../services/haptics/hapticFeedback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_CONTAINER_WIDTH = Math.min(SCREEN_WIDTH - 64, 340);

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

  const calculatedTotal = useMemo(() => {
    if (total !== undefined && total > 0) return total;
    return data.reduce((sum, item) => sum + (item.value || 0), 0);
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

  // Bar Data
  const barChartData = useMemo(() => {
    const result: any[] = [];
    (data || []).forEach((item, idx) => {
      result.push({
        value: item.value,
        label: item.label.length > 5 ? item.label.substring(0, 4) + '..' : item.label,
        frontColor: item.color || themeColors.primary,
        spacing: item.secondaryValue !== undefined ? 4 : 14,
        labelTextStyle: { color: themeColors.textSecondary, fontSize: 9 },
      });

      if (item.secondaryValue !== undefined) {
        result.push({
          value: item.secondaryValue,
          frontColor: themeColors.error,
          spacing: 14,
          labelTextStyle: { color: themeColors.textSecondary, fontSize: 9 },
        });
      }
    });
    return result;
  }, [data, themeColors]);

  // Line Data
  const lineChartData = useMemo(() => {
    return (data || []).map((item) => ({
      value: item.value,
      label: item.label,
      dataPointText: `${item.value}`,
    }));
  }, [data]);

  const handleSlicePress = (index: number) => {
    lightHaptic();
    setSelectedIndex((prev) => (prev === index ? null : index));
  };

  const selectedItem = selectedIndex !== null && data[selectedIndex] ? data[selectedIndex] : null;

  return (
    <View style={styles.card}>
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
            size={16}
            color={themeColors.primary}
          />
          <Text style={styles.title}>{title}</Text>
        </View>

        {calculatedTotal > 0 && (
          <Text style={styles.totalBadge}>
            {calculatedTotal.toFixed(2)} {currency}
          </Text>
        )}
      </View>

      {/* Selected Slice Inspection Pill */}
      {selectedItem && (
        <View style={styles.inspectionPill}>
          <View style={[styles.dot, { backgroundColor: selectedItem.color || themeColors.primary }]} />
          <Text style={styles.inspectionLabel}>{selectedItem.label}:</Text>
          <Text style={styles.inspectionValue}>
            {selectedItem.value.toFixed(2)} {currency} (
            {calculatedTotal > 0 ? ((selectedItem.value / calculatedTotal) * 100).toFixed(1) : 0}%)
          </Text>
        </View>
      )}

      {/* Chart Canvas */}
      <View style={styles.chartCanvas}>
        {chartType === 'donut' || chartType === 'pie' ? (
          <View style={styles.donutRow}>
            <PieChart
              data={pieChartData}
              donut={chartType === 'donut'}
              radius={56}
              innerRadius={36}
              isAnimated
              animationDuration={500}
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

            {/* Micro Legend */}
            <View style={styles.legendContainer}>
              {data.slice(0, 5).map((item, idx) => {
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
              data={barChartData}
              width={CHART_CONTAINER_WIDTH - 40}
              height={140}
              barWidth={16}
              isAnimated
              animationDuration={500}
              noOfSections={3}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={themeColors.border}
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
              width={CHART_CONTAINER_WIDTH - 40}
              height={130}
              color={themeColors.primary}
              thickness={2}
              curved
              isAnimated
              animationDuration={500}
              dataPointsColor={themeColors.primary}
              dataPointsRadius={4}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={themeColors.border}
              yAxisTextStyle={{ color: themeColors.textSecondary, fontSize: 8 }}
            />
          </View>
        )}
      </View>

      {/* Summary Footer */}
      {summary && (
        <View style={styles.summaryBox}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={14} color={themeColors.warning} />
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: themeColors.glass.background,
      borderColor: themeColors.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: spacing.md,
      marginVertical: spacing.sm,
      width: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    title: {
      ...typography.caption,
      color: themeColors.text,
      fontWeight: '700',
      fontSize: 12,
      letterSpacing: 0.5,
    },
    totalBadge: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 11,
      color: themeColors.primary,
      fontWeight: '700',
    },
    inspectionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 6,
      marginBottom: spacing.xs,
      gap: 6,
    },
    inspectionLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 10,
    },
    inspectionValue: {
      ...typography.caption,
      color: themeColors.text,
      fontWeight: '700',
      fontSize: 10,
    },
    chartCanvas: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.xs,
    },
    donutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      gap: 8,
    },
    centerLabelContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerLabelSuper: {
      fontSize: 8,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    centerLabelMain: {
      fontSize: 12,
      fontWeight: '800',
      color: themeColors.text,
    },
    legendContainer: {
      flex: 1,
      gap: 5,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 2,
      paddingHorizontal: 4,
      borderRadius: 4,
    },
    legendRowSelected: {
      backgroundColor: themeColors.surface,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: 6,
    },
    legendLabel: {
      ...typography.caption,
      fontSize: 10,
      color: themeColors.text,
      flex: 1,
    },
    legendPct: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 10,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    barContainer: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 6,
    },
    lineContainer: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 6,
    },
    summaryBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: themeColors.surface,
      padding: spacing.xs + 2,
      borderRadius: 8,
      marginTop: spacing.xs,
      gap: 6,
    },
    summaryText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 10,
      flex: 1,
      lineHeight: 14,
    },
  });
