/**
 * Purpose: Displays empty state with icon, message, and optional action
 * 
 * Inputs:
 *   - icon (string): MaterialCommunityIcons icon name
 *   - title (string): Main title text
 *   - message (string): Description message
 *   - actionLabel (string): Optional action button label
 *   - onAction (function): Optional action button callback
 * 
 * Outputs:
 *   - Returns (JSX.Element): Empty state component
 * 
 * Side effects:
 *   - Triggers haptic feedback when action button pressed
 *   - Calls onAction callback if provided
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic } from '../../services/haptics/hapticFeedback';

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  style,
}) => {
  const handleAction = () => {
    lightHaptic();
    onAction?.();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name={icon as any}
          size={80}
          color={colors.neutral.gray300}
        />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.button}
          onPress={handleAction}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Purpose: Empty state for transaction lists
 */
export const EmptyTransactions: React.FC<{ onAddTransaction?: () => void }> = ({
  onAddTransaction,
}) => (
  <EmptyState
    icon="receipt-text-outline"
    title="No Transactions Yet"
    message="Start tracking your finances by adding your first transaction"
    actionLabel={onAddTransaction ? 'Add Transaction' : undefined}
    onAction={onAddTransaction}
  />
);

/**
 * Purpose: Empty state for categories
 */
export const EmptyCategories: React.FC<{ onAddCategory?: () => void }> = ({
  onAddCategory,
}) => (
  <EmptyState
    icon="shape-outline"
    title="No Custom Categories"
    message="Create custom categories to better organize your transactions"
    actionLabel={onAddCategory ? 'Add Category' : undefined}
    onAction={onAddCategory}
  />
);

/**
 * Purpose: Empty state for subscriptions
 */
export const EmptySubscriptions: React.FC<{ onAddSubscription?: () => void }> = ({
  onAddSubscription,
}) => (
  <EmptyState
    icon="repeat"
    title="No Subscriptions"
    message="Add your recurring subscriptions to track monthly expenses automatically"
    actionLabel={onAddSubscription ? 'Add Subscription' : undefined}
    onAction={onAddSubscription}
  />
);

/**
 * Purpose: Empty state for recurring expenses
 */
export const EmptyRecurring: React.FC<{ onAddRecurring?: () => void }> = ({
  onAddRecurring,
}) => (
  <EmptyState
    icon="clock-outline"
    title="No Recurring Expenses"
    message="Set up recurring expenses to automate regular payments"
    actionLabel={onAddRecurring ? 'Add Recurring' : undefined}
    onAction={onAddRecurring}
  />
);

/**
 * Purpose: Empty state for accounts
 */
export const EmptyAccounts: React.FC<{ onAddAccount?: () => void }> = ({
  onAddAccount,
}) => (
  <EmptyState
    icon="wallet-outline"
    title="No Accounts"
    message="Create your first account to start managing your finances"
    actionLabel={onAddAccount ? 'Create Account' : undefined}
    onAction={onAddAccount}
  />
);

/**
 * Purpose: Empty state for search results
 */
export const EmptySearch: React.FC = () => (
  <EmptyState
    icon="magnify"
    title="No Results Found"
    message="Try adjusting your search terms or filters"
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.neutral.gray900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.neutral.gray500,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 300,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
  },
  buttonText: {
    ...typography.body,
    color: colors.neutral.white,
    fontWeight: '600',
  },
});
