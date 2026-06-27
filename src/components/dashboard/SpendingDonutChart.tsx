import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 24 * 2 - 12) / 2; // lg margins + gap/2
import { PieChart } from 'react-native-gifted-charts';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

interface CategorySpend {
  name: string;
  amount: number;
  color: string;
}

interface SpendingDonutChartProps {
  data: CategorySpend[];
  totalSpend: number;
}

const FALLBACK_COLORS = ['#4FC3F7', '#4DB6AC', '#FFB74D', '#CE93D8', '#EF9A9A', '#80CBC4'];

export const SpendingDonutChart: React.FC<SpendingDonutChartProps> = ({ data, totalSpend }) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const pieData = useMemo(() => {
    if (!data.length) return [{ value: 1, color: themeColors.border, text: '' }];
    return data.slice(0, 6).map((item, i) => ({
      value: item.amount,
      color: item.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      text: '',
    }));
  }, [data, themeColors]);

  const top4 = data.slice(0, 4);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Spending</Text>
      <View style={styles.row}>
        {/* Donut */}
        <PieChart
          data={pieData}
          donut
          radius={48}
          innerRadius={30}
          centerLabelComponent={() => (
            <Text style={styles.centerLabel}>
              {totalSpend > 0 ? `${((top4[0]?.amount ?? 0) / totalSpend * 100).toFixed(0)}%` : ''}
            </Text>
          )}
          isAnimated
          animationDuration={700}
        />

        {/* Legend */}
        <View style={styles.legend}>
          {top4.map((item, i) => {
            const pct = totalSpend > 0 ? ((item.amount / totalSpend) * 100).toFixed(0) : '0';
            const color = item.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
            return (
              <View key={item.name} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.catName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.pct}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: themeColors.glass.background,
      borderRadius: 16,
      padding: spacing.md,
      width: CARD_WIDTH,
      overflow: 'hidden',
    },
    title: {
      ...typography.bodyLarge,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing.sm,
    },
    centerLabel: {
      ...typography.bodySmall,
      fontWeight: '700',
      color: themeColors.text,
    },
    legend: {
      width: '100%',
      gap: spacing.xs,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      flexShrink: 0,
    },
    catName: {
      ...typography.caption,
      color: themeColors.textSecondary,
      flex: 1,
    },
    pct: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.text,
    },
  });
