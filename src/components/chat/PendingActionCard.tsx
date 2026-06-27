/**
 * Purpose: Display pending AI action with details and confirmation buttons
 *
 * Inputs:
 *   - action (PendingAction): Pending action to display
 *   - onConfirm (function): Callback when user confirms action
 *   - onCancel (function): Callback when user cancels action
 *
 * Outputs:
 *   - Returns (JSX.Element): Confirmation card with action details
 *
 * Side effects:
 *   - Triggers haptic feedback on button press
 *   - Calls onConfirm/onCancel callbacks
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { PendingAction } from '../../types/aiMutations';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { mediumHaptic } from '../../services/haptics/hapticFeedback';

interface PendingActionCardProps {
  action: PendingAction;
  onConfirm: (actionId: string) => Promise<void>;
  onCancel: (actionId: string) => void;
}

export const PendingActionCard: React.FC<PendingActionCardProps> = ({
  action,
  onConfirm,
  onCancel,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Calculate time remaining
  useEffect(() => {
    const updateTime = () => {
      const remaining = Math.max(0, action.expiresAt - Date.now());
      setTimeRemaining(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [action.expiresAt]);

  const handleConfirm = async () => {
    if (isConfirming) return;

    mediumHaptic();
    setIsConfirming(true);

    try {
      setConfirmError(null);
      await onConfirm(action.id);
    } catch (error: any) {
      console.error('[PendingActionCard] Confirm error:', error);
      setConfirmError(error?.message ?? 'Failed to execute action. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    mediumHaptic();
    onCancel(action.id);
  };

  // Get icon and color based on action type
  const actionIcon = useMemo(() => {
    switch (action.type) {
      case 'create':
        return 'plus-circle';
      case 'update':
        return 'pencil-circle';
      case 'delete':
        return 'delete-circle';
      default:
        return 'help-circle';
    }
  }, [action.type]);

  const actionColor = useMemo(() => {
    switch (action.type) {
      case 'create':
        return themeColors.success;
      case 'update':
        return themeColors.primary;
      case 'delete':
        return themeColors.error;
      default:
        return themeColors.textSecondary;
    }
  }, [action.type, themeColors]);

  // Format time remaining
  const timeRemainingText = useMemo(() => {
    if (timeRemaining <= 0) return 'Expired';

    const seconds = Math.floor(timeRemaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} left`;
    }
    return `${seconds}s left`;
  }, [timeRemaining]);

  const isExpired = timeRemaining <= 0;

  // Render action details based on entity type
  const renderActionDetails = () => {
    const data = action.resolvedData;

    switch (action.entityType) {
      case 'transaction':
        return (
          <>
            {data.amount && (
              <DetailRow
                label="Amount"
                value={`${data.amount.toFixed(2)}`}
                icon="cash"
              />
            )}
            {data.categoryName && (
              <DetailRow
                label="Category"
                value={data.categoryName}
                icon="folder"
              />
            )}
            {data.description && (
              <DetailRow
                label="Description"
                value={data.description}
                icon="text"
              />
            )}
            {data.vaultType && (
              <DetailRow
                label="Vault"
                value={data.vaultType}
                icon="wallet"
              />
            )}
          </>
        );

      case 'goal':
        return (
          <>
            {data.name && (
              <DetailRow
                label="Name"
                value={data.name}
                icon="target"
              />
            )}
            {data.targetAmount && (
              <DetailRow
                label="Target"
                value={`${data.targetAmount.toFixed(2)}`}
                icon="cash"
              />
            )}
            {data.fundingSource && (
              <DetailRow
                label="Funding"
                value={data.fundingSource}
                icon="bank"
              />
            )}
          </>
        );

      case 'debt':
        return (
          <>
            {data.personName && (
              <DetailRow
                label="Person"
                value={data.personName}
                icon="account"
              />
            )}
            {data.amount && (
              <DetailRow
                label="Amount"
                value={`${data.amount.toFixed(2)}`}
                icon="cash"
              />
            )}
            {data.dueDate && (
              <DetailRow
                label="Due Date"
                value={new Date(data.dueDate).toLocaleDateString()}
                icon="calendar"
              />
            )}
          </>
        );

      case 'subscription':
        return (
          <>
            {data.name && (
              <DetailRow
                label="Name"
                value={data.name}
                icon="repeat"
              />
            )}
            {data.amount && (
              <DetailRow
                label="Amount"
                value={`${data.amount.toFixed(2)}`}
                icon="cash"
              />
            )}
            {data.billingDay && (
              <DetailRow
                label="Billing Day"
                value={`${data.billingDay}`}
                icon="calendar"
              />
            )}
          </>
        );

      case 'recurringExpense':
        return (
          <>
            {data.name && (
              <DetailRow
                label="Name"
                value={data.name}
                icon="refresh"
              />
            )}
            {data.amount && (
              <DetailRow
                label="Amount"
                value={`${data.amount.toFixed(2)}`}
                icon="cash"
              />
            )}
            {data.frequency && (
              <DetailRow
                label="Frequency"
                value={`Every ${data.interval || 1} ${data.frequency}`}
                icon="clock"
              />
            )}
          </>
        );

      case 'category':
        return (
          <>
            {data.name && (
              <DetailRow
                label="Name"
                value={data.name}
                icon="folder"
              />
            )}
            {data.type && (
              <DetailRow
                label="Type"
                value={data.type}
                icon="tag"
              />
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name={actionIcon}
            size={24}
            color={actionColor}
          />
          <View style={styles.headerText}>
            <Text style={styles.actionType}>
              {action.type.charAt(0).toUpperCase() + action.type.slice(1)} {action.entityType}
            </Text>
            <Text style={styles.actionSummary}>{action.summary}</Text>
          </View>
        </View>

        {/* Time Remaining Badge */}
        <View style={[styles.timeBadge, isExpired && styles.expiredBadge]}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={12}
            color={isExpired ? themeColors.error : themeColors.textSecondary}
          />
          <Text style={[styles.timeText, isExpired && styles.expiredText]}>
            {timeRemainingText}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.details}>
        {renderActionDetails()}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancel}
          disabled={isConfirming}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={20}
            color={themeColors.error}
          />
          <Text style={[styles.buttonText, styles.cancelText]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.confirmButton,
            (isConfirming || isExpired) && styles.disabledButton,
          ]}
          onPress={handleConfirm}
          disabled={isConfirming || isExpired}
          activeOpacity={0.7}
        >
          {isConfirming ? (
            <ActivityIndicator size="small" color={themeColors.neutral.white} />
          ) : (
            <>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={themeColors.neutral.white}
              />
              <Text style={[styles.buttonText, styles.confirmText]}>
                Confirm
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Confirm error */}
      {confirmError && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={16} color={themeColors.error} />
          <Text style={styles.errorText}>{confirmError}</Text>
        </View>
      )}

      {/* Warning for sensitive actions */}
      {action.type === 'delete' && (
        <View style={styles.warningContainer}>
          <MaterialCommunityIcons
            name="alert"
            size={16}
            color={themeColors.warning}
          />
          <Text style={styles.warningText}>This action cannot be undone</Text>
        </View>
      )}
    </View>
  );
};

// Detail Row Component
interface DetailRowProps {
  label: string;
  value: string;
  icon: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, icon }) => {
  const themeColors = useThemeColors();

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
      minWidth: 0,
    }}>
      <MaterialCommunityIcons
        name={icon as any}
        size={16}
        color={themeColors.textSecondary}
        style={{ marginRight: spacing.sm, flexShrink: 0 }}
      />
      <Text style={{
        color: themeColors.textSecondary,
        marginRight: spacing.sm,
        flexShrink: 0,
      }}>
        {label}:
      </Text>
      <Text style={{
        color: themeColors.text,
        fontWeight: '600',
        flex: 1,
        flexWrap: 'wrap',
        minWidth: 0,
      }}>
        {value}
      </Text>
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: themeColors.primary,
      borderStyle: 'dashed',
      padding: spacing.md,
      marginVertical: spacing.sm,
      shadowColor: themeColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },

    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
      gap: spacing.sm,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    actionType: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
      fontWeight: '700',
      marginBottom: spacing.xs / 2,
      flexWrap: 'wrap',
    },
    actionSummary: {
      ...typography.body,
      color: themeColors.text,
      fontWeight: '600',
      flexWrap: 'wrap',
    },

    // Time Badge
    timeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs / 2,
      backgroundColor: themeColors.background,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
      borderRadius: borderRadius.sm,
    },
    expiredBadge: {
      backgroundColor: `${themeColors.error}15`,
    },
    timeText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    expiredText: {
      color: themeColors.error,
    },

    // Details
    details: {
      backgroundColor: themeColors.background,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      marginBottom: spacing.md,
    },

    // Actions
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.sm,
    },
    cancelButton: {
      backgroundColor: `${themeColors.error}15`,
      borderWidth: 1,
      borderColor: themeColors.error,
    },
    confirmButton: {
      backgroundColor: themeColors.success,
    },
    disabledButton: {
      opacity: 0.5,
    },
    buttonText: {
      ...typography.body,
      fontWeight: '700',
    },
    cancelText: {
      color: themeColors.error,
    },
    confirmText: {
      color: themeColors.neutral.white,
    },

    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      padding: spacing.sm,
      backgroundColor: `${themeColors.error}15`,
      borderRadius: borderRadius.sm,
    },
    errorText: {
      ...typography.bodySmall,
      color: themeColors.error,
      flex: 1,
    },

    // Warning
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      padding: spacing.sm,
      backgroundColor: `${themeColors.warning}15`,
      borderRadius: borderRadius.sm,
    },
    warningText: {
      ...typography.bodySmall,
      color: themeColors.warning,
      fontWeight: '600',
    },
  });
