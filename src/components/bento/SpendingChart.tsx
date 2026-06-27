import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { AnimatePresence, MotiView } from 'moti';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { BentoCard } from './BentoCard';
import { useThemeColors } from '../../hooks/useThemeColors';
import { mmkv } from '../../store/middleware/mmkvStorage';

interface ChartDataPoint {
  day: string;
  income: number;
  expense: number;
}

interface SpendingChartProps {
  data: ChartDataPoint[];
  delay?: number;
  accountCurrency?: string;
}

type ChartMode = 'combined' | 'income' | 'expenses';

const { width } = Dimensions.get('window');
const chartWidth = width - (spacing.lg * 4);

/**
 * Purpose: Multi-mode chart component for displaying income and expense trends
 * Supports 3 modes: Combined line chart, Income bars, Expense bars
 */
export const SpendingChart: React.FC<SpendingChartProps> = ({
  data,
  delay = 0,
  accountCurrency = 'USD',
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Load persisted mode or default to 'expenses'
  const [selectedMode, setSelectedMode] = useState<ChartMode>(() => {
    const saved = mmkv.getString('dashboard_chart_mode');
    return (saved as ChartMode) || 'expenses';
  });

  const handleModeChange = (mode: ChartMode) => {
    setSelectedMode(mode);
    mmkv.set('dashboard_chart_mode', mode);
  };

  // Calculate max value for scaling
  const calculateMaxValue = (values: number[]) => {
    const max = Math.max(...values, 100);
    return Math.ceil(max / 50) * 50; // Round up to nearest 50
  };

  // Prepare data for line chart
  const prepareLineData = (dataPoints: ChartDataPoint[], type: 'income' | 'expense') => {
    return dataPoints.map((item, index) => ({
      value: type === 'income' ? item.income : item.expense,
      label: item.day.split(' ')[1] || item.day,
      dataPointText: accountCurrency === 'USD'
        ? `$${(type === 'income' ? item.income : item.expense).toFixed(0)}`
        : `${(type === 'income' ? item.income : item.expense).toFixed(0)} ${accountCurrency}`,
    }));
  };

  // Prepare data for bar chart
  const prepareBarData = (dataPoints: ChartDataPoint[], type: 'income' | 'expense') => {
    const color = type === 'income' ? themeColors.success : themeColors.error;
    return dataPoints.map((item) => ({
      value: type === 'income' ? item.income : item.expense,
      label: item.day.split(' ')[1] || item.day,
      frontColor: color,
      gradientColor: color + '80',
      topLabelComponent: () => (
        <Text style={{ fontSize: 10, color: themeColors.textSecondary }}>
          {accountCurrency === 'USD'
            ? `$${(type === 'income' ? item.income : item.expense).toFixed(0)}`
            : `${(type === 'income' ? item.income : item.expense).toFixed(0)}`}
        </Text>
      ),
    }));
  };

  // Render combined line chart
  const renderCombinedLineChart = () => {
    const incomeData = prepareLineData(data, 'income');
    const expenseData = prepareLineData(data, 'expense');

    const allValues = data.flatMap(d => [d.income, d.expense]);
    const maxValue = calculateMaxValue(allValues);

    return (
      <View style={styles.chartWrapper}>
        <LineChart
          data={expenseData}
          data2={incomeData}
          height={150}
          width={chartWidth - 60}
          color={themeColors.error}
          color2={themeColors.success}
          thickness={3}
          curved={true}
          areaChart={false}
          dataPointsColor={themeColors.error}
          dataPointsColor2={themeColors.success}
          dataPointsRadius={4}
          xAxisLabelTextStyle={{
            color: themeColors.textSecondary,
            fontSize: 10,
          }}
          yAxisTextStyle={{
            color: themeColors.textSecondary,
            fontSize: 10,
          }}
          rulesType="solid"
          rulesColor={themeColors.border}
          showVerticalLines={false}
          spacing={(chartWidth - 60) / 7}
          initialSpacing={20}
          endSpacing={20}
          noOfSections={4}
          maxValue={maxValue}
          yAxisLabelPrefix="$"
        />
      </View>
    );
  };

  // Render bar chart (income or expense)
  const renderBarChart = (type: 'income' | 'expense') => {
    const barData = prepareBarData(data, type);
    const values = data.map(d => type === 'income' ? d.income : d.expense);
    const maxValue = calculateMaxValue(values);

    return (
      <View style={styles.chartWrapper}>
        <BarChart
          data={barData}
          height={150}
          width={chartWidth - 60}
          frontColor={type === 'income' ? themeColors.success : themeColors.error}
          gradientColor={(type === 'income' ? themeColors.success : themeColors.error) + '80'}
          showGradient={true}
          barWidth={24}
          barBorderRadius={6}
          spacing={(chartWidth - 60) / 7 - 24}
          xAxisLabelTextStyle={{
            color: themeColors.textSecondary,
            fontSize: 10,
          }}
          yAxisTextStyle={{
            color: themeColors.textSecondary,
            fontSize: 10,
          }}
          rulesType="solid"
          rulesColor={themeColors.border}
          showVerticalLines={false}
          initialSpacing={20}
          endSpacing={20}
          noOfSections={4}
          maxValue={maxValue}
          yAxisLabelPrefix="$"
        />
      </View>
    );
  };

  // Render appropriate chart based on selected mode
  const renderChart = () => {
    if (selectedMode === 'combined') {
      return renderCombinedLineChart();
    } else if (selectedMode === 'income') {
      return renderBarChart('income');
    } else {
      return renderBarChart('expense');
    }
  };

  // Get empty state message based on mode
  const getEmptyMessage = () => {
    switch (selectedMode) {
      case 'combined':
        return 'Your income and expense trends will appear here';
      case 'income':
        return 'Your income trends will appear here';
      case 'expenses':
        return 'Your expense trends will appear here';
      default:
        return 'Your transaction trends will appear here';
    }
  };

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <BentoCard delay={delay} style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Transaction Trends</Text>
            <Text style={styles.subtitle}>Last 7 days</Text>
          </View>
          <MaterialCommunityIcons
            name="chart-bar"
            size={24}
            color={themeColors.primary}
          />
        </View>

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeTab, selectedMode === 'combined' && styles.modeTabActive]}
            onPress={() => handleModeChange('combined')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={16}
              color={selectedMode === 'combined' ? '#FFFFFF' : themeColors.textSecondary}
            />
            <Text style={[
              styles.modeTabText,
              selectedMode === 'combined' && styles.modeTabTextActive
            ]}>
              Combined
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, selectedMode === 'income' && styles.modeTabActive]}
            onPress={() => handleModeChange('income')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="plus-circle"
              size={16}
              color={selectedMode === 'income' ? '#FFFFFF' : themeColors.textSecondary}
            />
            <Text style={[
              styles.modeTabText,
              selectedMode === 'income' && styles.modeTabTextActive
            ]}>
              Income
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, selectedMode === 'expenses' && styles.modeTabActive]}
            onPress={() => handleModeChange('expenses')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="minus-circle"
              size={16}
              color={selectedMode === 'expenses' ? '#FFFFFF' : themeColors.textSecondary}
            />
            <Text style={[
              styles.modeTabText,
              selectedMode === 'expenses' && styles.modeTabTextActive
            ]}>
              Expenses
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="chart-line-variant"
            size={48}
            color={themeColors.textSecondary}
          />
          <Text style={styles.emptyText}>No transaction data</Text>
          <Text style={styles.emptySubtext}>{getEmptyMessage()}</Text>
        </View>
      </BentoCard>
    );
  }

  return (
    <BentoCard delay={delay} style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Transaction Trends</Text>
          <Text style={styles.subtitle}>Last 7 days</Text>
        </View>
        <MaterialCommunityIcons
          name="chart-bar"
          size={24}
          color={themeColors.primary}
        />
      </View>

      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeTab, selectedMode === 'combined' && styles.modeTabActive]}
          onPress={() => handleModeChange('combined')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="chart-line"
            size={16}
            color={selectedMode === 'combined' ? '#FFFFFF' : themeColors.textSecondary}
          />
          <Text style={[
            styles.modeTabText,
            selectedMode === 'combined' && styles.modeTabTextActive
          ]}>
            Combined
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, selectedMode === 'income' && styles.modeTabActive]}
          onPress={() => handleModeChange('income')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="plus-circle"
            size={16}
            color={selectedMode === 'income' ? '#FFFFFF' : themeColors.textSecondary}
          />
          <Text style={[
            styles.modeTabText,
            selectedMode === 'income' && styles.modeTabTextActive
          ]}>
            Income
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, selectedMode === 'expenses' && styles.modeTabActive]}
          onPress={() => handleModeChange('expenses')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="minus-circle"
            size={16}
            color={selectedMode === 'expenses' ? '#FFFFFF' : themeColors.textSecondary}
          />
          <Text style={[
            styles.modeTabText,
            selectedMode === 'expenses' && styles.modeTabTextActive
          ]}>
            Expenses
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chart with Animation */}
      <AnimatePresence exitBeforeEnter>
        <MotiView
          key={selectedMode}
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -10 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          {renderChart()}
        </MotiView>
      </AnimatePresence>

      {/* Legend */}
      <View style={styles.footer}>
        {selectedMode === 'combined' ? (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: themeColors.success }]} />
              <Text style={styles.legendText}>Income</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: themeColors.error }]} />
              <Text style={styles.legendText}>Expenses</Text>
            </View>
          </>
        ) : (
          <View style={styles.legendItem}>
            <View style={[
              styles.legendDot,
              { backgroundColor: selectedMode === 'income' ? themeColors.success : themeColors.error }
            ]} />
            <Text style={styles.legendText}>
              {selectedMode === 'income' ? 'Income' : 'Expenses'}
            </Text>
          </View>
        )}
      </View>
    </BentoCard>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    minHeight: 320,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    color: themeColors.text,
  },
  subtitle: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: themeColors.surface,
    borderRadius: 8,
    padding: 4,
    marginBottom: spacing.md,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 6,
    gap: 4,
  },
  modeTabActive: {
    backgroundColor: themeColors.primary,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  chartWrapper: {
    marginVertical: spacing.md,
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    ...typography.h4,
    color: themeColors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.body,
    color: themeColors.textSecondary,
    textAlign: 'center',
  },
});
