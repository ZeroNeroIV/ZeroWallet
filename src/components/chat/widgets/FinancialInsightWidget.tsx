/**
 * FinancialInsightWidget — Generative UI Financial Health & Runway Audit
 *
 * Displays an autonomous financial score, liquid runway months meter,
 * savings rate percentage, and proactive recommendations.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useThemeColors } from '../../../hooks/useThemeColors';

interface FinancialInsightWidgetProps {
  score: number;
  grade: 'EXCELLENT' | 'STABLE' | 'NEEDS_ATTENTION' | 'CRITICAL';
  runwayMonths: number;
  savingsRate: number;
  burnRate: number;
  recommendations: string[];
}

export const FinancialInsightWidget: React.FC<FinancialInsightWidgetProps> = ({
  score,
  grade,
  runwayMonths,
  savingsRate,
  recommendations,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const gradeColor = useMemo(() => {
    switch (grade) {
      case 'EXCELLENT':
        return themeColors.success;
      case 'STABLE':
        return themeColors.primary;
      case 'NEEDS_ATTENTION':
        return themeColors.warning;
      case 'CRITICAL':
        return themeColors.error;
      default:
        return themeColors.primary;
    }
  }, [grade, themeColors]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="shield-check" size={16} color={gradeColor} />
          <Text style={styles.title}>FINANCIAL HEALTH AUDIT</Text>
        </View>

        <View style={[styles.gradeBadge, { backgroundColor: gradeColor + '20' }]}>
          <Text style={[styles.gradeText, { color: gradeColor }]}>{grade}</Text>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsGrid}>
        {/* Score */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>HEALTH SCORE</Text>
          <Text style={[styles.metricValue, { color: gradeColor }]}>{score}/100</Text>
        </View>

        {/* Runway */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>RUNWAY</Text>
          <Text style={styles.metricValue}>{runwayMonths} Mo</Text>
        </View>

        {/* Savings Rate */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>SAVINGS RATE</Text>
          <Text style={[styles.metricValue, { color: savingsRate > 0 ? themeColors.success : themeColors.textSecondary }]}>
            {savingsRate}%
          </Text>
        </View>
      </View>

      {/* Runway Bar Gauge */}
      <View style={styles.gaugeContainer}>
        <View style={styles.gaugeBarBackground}>
          <View
            style={[
              styles.gaugeBarFill,
              {
                width: `${Math.min(100, Math.max(5, (runwayMonths / 6) * 100))}%`,
                backgroundColor: gradeColor,
              },
            ]}
          />
        </View>
        <Text style={styles.gaugeCaption}>
          Target: 6.0 Months emergency buffer ({Math.min(100, Math.round((runwayMonths / 6) * 100))}% funded)
        </Text>
      </View>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <View style={styles.recommendationsList}>
          {recommendations.map((rec, i) => (
            <View key={i} style={styles.recRow}>
              <MaterialCommunityIcons name="check" size={12} color={gradeColor} style={{ marginTop: 2 }} />
              <Text style={styles.recText}>{rec}</Text>
            </View>
          ))}
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
    },
    title: {
      ...typography.caption,
      color: themeColors.text,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    gradeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    gradeText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    metricsGrid: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: themeColors.surface,
      borderRadius: 8,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    metricCell: {
      alignItems: 'center',
      flex: 1,
    },
    metricLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    metricValue: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: themeColors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    gaugeContainer: {
      marginBottom: spacing.xs,
    },
    gaugeBarBackground: {
      height: 6,
      backgroundColor: themeColors.surface,
      borderRadius: 3,
      overflow: 'hidden',
    },
    gaugeBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    gaugeCaption: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 9,
      marginTop: 4,
    },
    recommendationsList: {
      marginTop: spacing.xs,
      gap: 4,
    },
    recRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    recText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 10,
      flex: 1,
      lineHeight: 14,
    },
  });
