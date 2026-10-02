// Simplizum Category Ranked Bars — Horizontal Hairline Progress Lines with Tabular Figures
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import type { CategorySpendItem } from '../../services/analyticsService';

interface CategoryRankedBarsProps {
  items: CategorySpendItem[];
  currency: string;
  onSelectCategory?: (category: CategorySpendItem) => void;
}

export const CategoryRankedBars: React.FC<CategoryRankedBarsProps> = ({
  items = [],
  currency,
  onSelectCategory,
}) => {
  const themeColors = useThemeColors();

  if (items.length === 0) {
    return (
      <View
        style={[
          styles.emptyCard,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.cardBorder,
          },
        ]}
      >
        <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
          No category expense data for this time horizon.
        </Text>
      </View>
    );
  }

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
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>
          CATEGORY ALLOCATION
        </Text>
        <Text style={[styles.subTitle, { color: themeColors.textMuted }]}>
          RANKED BY EXPENDITURE
        </Text>
      </View>

      <View style={styles.listContainer}>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <TouchableOpacity
              key={item.categoryId}
              activeOpacity={0.7}
              onPress={() => {
                triggerHaptic('selection');
                onSelectCategory?.(item);
              }}
              style={[
                styles.itemRow,
                !isLast && {
                  borderBottomWidth: 1,
                  borderBottomColor: themeColors.hairline,
                },
              ]}
            >
              {/* Top row: Icon + Name + Percentage + Amount */}
              <View style={styles.rowTop}>
                <View style={styles.rowLeft}>
                  <View
                    style={[
                      styles.iconBadge,
                      {
                        backgroundColor: themeColors.background,
                        borderColor: themeColors.hairline,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.categoryIcon || 'tag-outline'}
                      size={15}
                      color={themeColors.text}
                    />
                  </View>

                  <Text
                    style={[styles.categoryName, { color: themeColors.text }]}
                    numberOfLines={1}
                  >
                    {item.categoryName}
                  </Text>
                </View>

                <View style={styles.rowRight}>
                  <Text style={[styles.amountText, { color: themeColors.text }]}>
                    {formatCurrency(item.amount, currency)}
                  </Text>
                  <Text style={[styles.percentageText, { color: themeColors.textMuted }]}>
                    {item.percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>

              {/* Horizontal Razor-Thin Progress Line */}
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: themeColors.hairline },
                ]}
              >
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.min(100, Math.max(2, item.percentage))}%`,
                      backgroundColor: themeColors.text,
                    },
                  ]}
                />
              </View>
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
    marginBottom: 20,
  },
  emptyCard: {
    padding: 24,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 13,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  },
  listContainer: {
    marginTop: 4,
  },
  itemRow: {
    paddingVertical: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  percentageText: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 2,
    width: '100%',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1,
  },
});
