import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic } from '../../services/haptics/hapticFeedback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// card margin(24*2) + card padding(16*2) + yAxis label area(50)
const CHART_WIDTH = SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2 - 50;

interface MonthDataPoint {
  month: string;
  income: number;
  expense: number;
}

interface IncomeExpenseChartProps {
  data: MonthDataPoint[];
}

export const IncomeExpenseChart: React.FC<IncomeExpenseChartProps> = ({ data }) => {
  const themeColors = useThemeColors();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const barData = useMemo(() => {
    const result: any[] = [];
    data.forEach((point, i) => {
      result.push({
        value: point.income,
        label: point.month,
        frontColor: themeColors.primary,
        gradientColor: themeColors.primaryDark || '#0288D1',
        spacing: 4,
        labelTextStyle: { color: themeColors.textSecondary, fontSize: 10 },
      });
      result.push({
        value: point.expense,
        frontColor: themeColors.error,
        gradientColor: themeColors.errorDark || '#FF8A65',
        spacing: i < data.length - 1 ? 18 : 0,
        labelTextStyle: { color: themeColors.textSecondary, fontSize: 10 },
      });
    });
    return result;
  }, [data, themeColors]);

  const maxVal = useMemo(() => {
    const m = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
    return Math.ceil(m / 100) * 100;
  }, [data]);

  const hasData = useMemo(
    () => data.some((d) => d.income > 0 || d.expense > 0),
    [data]
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Income vs Expenses</Text>
          <Text style={styles.scrubHint}>Tap any bar to inspect month</Text>
        </View>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: themeColors.primary }]} />
          <Text style={styles.legendLabel}>In</Text>
          <View style={[styles.legendDot, { backgroundColor: themeColors.error }]} />
          <Text style={styles.legendLabel}>Out</Text>
        </View>
      </View>

      {hoverIndex !== null && data[hoverIndex] && (
        <View style={styles.tooltipBox}>
          <Text style={styles.tooltipMonth}>{data[hoverIndex].month}</Text>
          <View style={styles.tooltipMetrics}>
            <Text style={[styles.tooltipVal, { color: themeColors.primary }]}>
              +{data[hoverIndex].income.toFixed(2)}
            </Text>
            <Text style={[styles.tooltipVal, { color: themeColors.error }]}>
              -{data[hoverIndex].expense.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {!hasData && (
        <Text style={styles.emptyNote}>
          No income or expenses in the last 6 months yet.
        </Text>
      )}

      <BarChart
        key={data.map(d => `${d.income}-${d.expense}`).join('|')}
        data={barData}
        barWidth={14}
        isAnimated
        animationDuration={600}
        width={CHART_WIDTH}
        height={140}
        maxValue={maxVal}
        noOfSections={3}
        yAxisColor="transparent"
        xAxisColor={themeColors.border}
        yAxisTextStyle={{ color: themeColors.textSecondary, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: themeColors.textSecondary, fontSize: 10 }}
        rulesColor={themeColors.border + '60'}
        rulesType="solid"
        showGradient
        barBorderRadius={6}
        backgroundColor="transparent"
        hideYAxisText={false}
        initialSpacing={8}
        endSpacing={8}
        onPress={(params: any) => {
          lightHaptic();
          const section = data.findIndex(
            d => Math.abs(d.income - params.value) < 5 || Math.abs(d.expense - params.value) < 5
          );
          if (section >= 0) setHoverIndex(section);
        }}
      />
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: themeColors.glass.background,
      borderRadius: 16,
      padding: spacing.md,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    title: {
      ...typography.bodyLarge,
      fontWeight: '700',
      color: themeColors.text,
    },
    emptyNote: {
      ...typography.caption,
      color: themeColors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    legend: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      ...typography.caption,
      fontSize: 10,
      color: themeColors.textSecondary,
      marginRight: 4,
    },
    scrubHint: {
      ...typography.caption,
      fontSize: 10,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    tooltipBox: {
      backgroundColor: themeColors.surface,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      alignSelf: 'center',
      marginBottom: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    tooltipMonth: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.text,
    },
    tooltipMetrics: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tooltipVal: {
      ...typography.caption,
      fontWeight: '700',
      fontSize: 11,
    },
  });
