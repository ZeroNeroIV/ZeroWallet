// Simplizum Dual-Bar Histogram — Hairline Inflow vs Outflow comparisons with interactive touch scrubber
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import type { HistogramBucket } from '../../services/analyticsService';

interface DualBarHistogramProps {
  buckets: HistogramBucket[];
  currency: string;
}

export const DualBarHistogram: React.FC<DualBarHistogramProps> = ({
  buckets = [],
  currency,
}) => {
  const themeColors = useThemeColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const maxVal = useMemo(() => {
    let max = 100;
    for (const b of buckets) {
      if (b.inflow > max) max = b.inflow;
      if (b.outflow > max) max = b.outflow;
    }
    return max * 1.15;
  }, [buckets]);

  const activeBucket = selectedIndex !== null ? buckets[selectedIndex] : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.cardBorder,
        },
      ]}
    >
      {/* Top Header & Interactive Highlight Stats */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>
            CASH FLOW HISTOGRAM
          </Text>
          <Text style={[styles.subTitle, { color: themeColors.textMuted }]}>
            INFLOW VS OUTFLOW DYNAMICS
          </Text>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: themeColors.success }]} />
            <Text style={[styles.legendText, { color: themeColors.textMuted }]}>INFLOW</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: themeColors.text }]} />
            <Text style={[styles.legendText, { color: themeColors.textMuted }]}>OUTFLOW</Text>
          </View>
        </View>
      </View>

      {/* Scrubber / Active Selection Display */}
      {activeBucket ? (
        <View style={[styles.activeInfoBox, { backgroundColor: themeColors.background, borderColor: themeColors.hairline }]}>
          <Text style={[styles.activeBucketLabel, { color: themeColors.text }]}>
            {activeBucket.label} BREAKDOWN
          </Text>
          <View style={styles.activeStatsRow}>
            <Text style={[styles.activeStatValue, { color: themeColors.success }]}>
              +{formatCurrency(activeBucket.inflow, currency)}
            </Text>
            <Text style={[styles.activeStatValue, { color: themeColors.text }]}>
              -{formatCurrency(activeBucket.outflow, currency)}
            </Text>
            <Text
              style={[
                styles.activeStatValue,
                { color: activeBucket.net >= 0 ? themeColors.success : themeColors.error },
              ]}
            >
              NET {activeBucket.net >= 0 ? '+' : ''}{formatCurrency(activeBucket.net, currency)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.infoSpacer} />
      )}

      {/* Histogram Bars Container */}
      <View style={styles.barsContainer}>
        {buckets.map((b, idx) => {
          const isSelected = selectedIndex === idx;
          const inflowHeight = Math.max(3, (b.inflow / maxVal) * 110);
          const outflowHeight = Math.max(3, (b.outflow / maxVal) * 110);

          return (
            <TouchableOpacity
              key={b.label + idx}
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic('selection');
                setSelectedIndex(isSelected ? null : idx);
              }}
              style={[
                styles.barGroup,
                isSelected && {
                  backgroundColor: themeColors.surfaceHighlight,
                  borderRadius: 2,
                },
              ]}
            >
              <View style={styles.barsPair}>
                {/* Inflow Bar */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: inflowHeight,
                        backgroundColor: themeColors.success,
                      },
                    ]}
                  />
                </View>

                {/* Outflow Bar */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: outflowHeight,
                        backgroundColor: themeColors.text,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Bucket Label */}
              <Text
                style={[
                  styles.bucketLabel,
                  {
                    color: isSelected ? themeColors.text : themeColors.textMuted,
                    fontWeight: isSelected ? '700' : '600',
                  },
                ]}
              >
                {b.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subTitle: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  infoSpacer: {
    height: 44,
  },
  activeInfoBox: {
    height: 44,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activeBucketLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  activeStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  activeStatValue: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingTop: 8,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingVertical: 4,
  },
  barsPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    flex: 1,
  },
  barTrack: {
    width: 7,
    height: 110,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 1,
  },
  bucketLabel: {
    fontSize: 9,
    marginTop: 6,
    letterSpacing: 0.6,
  },
});
