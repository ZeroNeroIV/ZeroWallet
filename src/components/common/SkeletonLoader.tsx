/**
 * Purpose: Provides animated skeleton loading placeholders for async content
 * 
 * Inputs:
 *   - width (number | string): Width of skeleton (default: '100%')
 *   - height (number): Height of skeleton (default: 20)
 *   - borderRadius (number): Border radius (default: 4)
 *   - style (ViewStyle): Additional custom styles
 * 
 * Outputs:
 *   - Returns (JSX.Element): Animated skeleton placeholder
 * 
 * Side effects: None (pure component)
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { Skeleton } from 'moti/skeleton';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const { width: screenWidth } = Dimensions.get('window');

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Purpose: Single skeleton line placeholder
 */
export function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonLoaderProps) {
  // Convert percentage to number for Skeleton component
  const numericWidth = typeof width === 'string' && width.endsWith('%')
    ? (parseFloat(width) / 100) * screenWidth
    : typeof width === 'number' ? width : screenWidth;

  return (
    <Skeleton
      colorMode="light"
      radius={borderRadius}
      height={height}
      width={numericWidth}
      colors={[colors.neutral.gray200, colors.neutral.gray300, colors.neutral.gray200]}
    >
      <View style={[{ height, width: numericWidth, borderRadius }, style]} />
    </Skeleton>
  );
}

/**
 * Purpose: Transaction item skeleton placeholder
 */
export function TransactionSkeleton() {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 300 }}
      style={styles.transactionContainer}
    >
      <View style={styles.transactionRow}>
        <SkeletonLoader width={48} height={48} borderRadius={24} />
        <View style={styles.transactionDetails}>
          <SkeletonLoader width="60%" height={18} />
          <View style={{ marginTop: spacing.xs }} />
          <SkeletonLoader width="40%" height={14} />
        </View>
        <SkeletonLoader width={80} height={20} />
      </View>
    </MotiView>
  );
}

/**
 * Purpose: Dashboard card skeleton placeholder
 */
export function DashboardCardSkeleton({ height = 120 }: { height?: number }) {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 300 }}
      style={[styles.cardContainer, { height }]}
    >
      <View style={styles.cardContent}>
        <SkeletonLoader width="50%" height={18} />
        <View style={{ marginTop: spacing.md }} />
        <SkeletonLoader width="80%" height={32} />
        <View style={{ marginTop: spacing.sm }} />
        <SkeletonLoader width="60%" height={14} />
      </View>
    </MotiView>
  );
}

/**
 * Purpose: Balance card skeleton placeholder
 */
export function BalanceCardSkeleton() {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 300 }}
      style={styles.balanceCard}
    >
      <View style={styles.balanceContent}>
        <SkeletonLoader width="40%" height={16} />
        <View style={{ marginTop: spacing.md }} />
        <SkeletonLoader width="70%" height={48} />
        <View style={{ marginTop: spacing.sm }} />
        <SkeletonLoader width="30%" height={18} />
      </View>
    </MotiView>
  );
}

/**
 * Purpose: List of transaction skeletons
 */
export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <React.Fragment key={index}>
          <TransactionSkeleton />
          {index < count - 1 && <View style={styles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * Purpose: Category item skeleton placeholder
 */
export function CategorySkeleton() {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 300 }}
      style={styles.categoryContainer}
    >
      <View style={styles.categoryRow}>
        <SkeletonLoader width={40} height={40} borderRadius={20} />
        <View style={styles.categoryDetails}>
          <SkeletonLoader width="50%" height={16} />
        </View>
      </View>
    </MotiView>
  );
}

/**
 * Purpose: Subscription item skeleton placeholder
 */
export function SubscriptionSkeleton() {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 300 }}
      style={styles.subscriptionContainer}
    >
      <View style={styles.subscriptionRow}>
        <View style={styles.subscriptionInfo}>
          <SkeletonLoader width="60%" height={18} />
          <View style={{ marginTop: spacing.xs }} />
          <SkeletonLoader width="40%" height={14} />
        </View>
        <SkeletonLoader width={60} height={32} borderRadius={16} />
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  transactionContainer: {
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing.md,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  transactionDetails: {
    flex: 1,
  },

  cardContainer: {
    backgroundColor: colors.neutral.white,
    borderRadius: 16,
    padding: spacing.lg,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },

  balanceCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: 16,
    padding: spacing.xl,
    minHeight: 180,
  },
  balanceContent: {
    flex: 1,
    justifyContent: 'center',
  },

  listContainer: {
    backgroundColor: colors.neutral.white,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.gray200,
    marginHorizontal: spacing.md,
  },

  categoryContainer: {
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  categoryDetails: {
    flex: 1,
  },

  subscriptionContainer: {
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionInfo: {
    flex: 1,
  },
});
