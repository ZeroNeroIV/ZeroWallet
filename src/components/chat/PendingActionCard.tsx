/**
 * PendingActionCard — Simplizum Inline Architectural Action Ticket
 *
 * Razor-thin hairline spec ticket within the message feed showing
 * exact mutation parameters with high-contrast instantaneous CONFIRM and CANCEL buttons.
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
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { mediumHaptic, heavyHaptic, lightHaptic } from '../../services/haptics/hapticFeedback';

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
    heavyHaptic();
    setIsConfirming(true);
    try {
      setConfirmError(null);
      await onConfirm(action.id);
    } catch (error: any) {
      console.error('[PendingActionCard] Confirm error:', error);
      setConfirmError(error?.message ?? 'Failed to execute action.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    lightHaptic();
    onCancel(action.id);
  };

  const isExpired = timeRemaining <= 0;

  const timeRemainingText = useMemo(() => {
    if (isExpired) return 'EXPIRED';
    const seconds = Math.floor(timeRemaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    return `${minutes}:${remSec.toString().padStart(2, '0')}`;
  }, [timeRemaining, isExpired]);

  const renderSpecs = () => {
    const data = action.resolvedData || {};
    const rows: { label: string; value: string; isMono?: boolean }[] = [];

    if (action.entityType === 'transaction') {
      if (data.amount !== undefined) rows.push({ label: 'AMOUNT', value: `$${Number(data.amount).toFixed(2)}`, isMono: true });
      if (data.categoryName) rows.push({ label: 'CATEGORY', value: data.categoryName });
      if (data.vaultType) rows.push({ label: 'DESTINATION', value: String(data.vaultType).toUpperCase() });
      if (data.description) rows.push({ label: 'NOTE', value: data.description });
    } else if (action.entityType === 'goal') {
      if (data.name) rows.push({ label: 'GOAL NAME', value: data.name });
      if (data.targetAmount) rows.push({ label: 'TARGET', value: `$${Number(data.targetAmount).toFixed(2)}`, isMono: true });
      if (data.fundingSource) rows.push({ label: 'FUNDING', value: data.fundingSource });
    } else if (action.entityType === 'debt') {
      if (data.personName) rows.push({ label: 'COUNTERPARTY', value: data.personName });
      if (data.amount) rows.push({ label: 'AMOUNT', value: `$${Number(data.amount).toFixed(2)}`, isMono: true });
      if (data.dueDate) rows.push({ label: 'DUE DATE', value: new Date(data.dueDate).toISOString().split('T')[0] });
    } else if (action.entityType === 'subscription' || action.entityType === 'recurringExpense') {
      if (data.name) rows.push({ label: 'SERVICE', value: data.name });
      if (data.amount) rows.push({ label: 'AMOUNT', value: `$${Number(data.amount).toFixed(2)}`, isMono: true });
      if (data.frequency) rows.push({ label: 'INTERVAL', value: `Every ${data.interval || 1} ${data.frequency}` });
    } else if (action.entityType === 'category') {
      if (data.name) rows.push({ label: 'CATEGORY', value: data.name });
      if (data.type) rows.push({ label: 'TYPE', value: String(data.type).toUpperCase() });
    }

    return (
      <View style={styles.specsTable}>
        {rows.map((r, idx) => (
          <View key={idx} style={[styles.specRow, idx > 0 && styles.specDivider]}>
            <Text style={styles.specLabel}>{r.label}</Text>
            <Text style={[styles.specValue, r.isMono ? styles.monoVal : null]} numberOfLines={1}>
              {r.value}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.ticketCard}>
      {/* Ticket Header */}
      <View style={styles.ticketHeader}>
        <View>
          <Text style={styles.ticketSuper}>MUTATION SPECIFICATION</Text>
          <Text style={styles.ticketAction}>
            {action.type.toUpperCase()} · {action.entityType.toUpperCase()}
          </Text>
        </View>
        <View style={[styles.timeBadge, isExpired ? styles.timeBadgeExpired : null]}>
          <Text style={[styles.timeText, isExpired ? styles.timeTextExpired : null]}>
            {timeRemainingText}
          </Text>
        </View>
      </View>

      {/* Summary Note */}
      {action.summary && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>{action.summary}</Text>
        </View>
      )}

      {/* Specs Matrix */}
      {renderSpecs()}

      {/* Confirmation Error */}
      {confirmError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{confirmError}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonDeck}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={isConfirming}
        >
          <Text style={styles.cancelText}>CANCEL</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, (isConfirming || isExpired) ? styles.disabledBtn : null]}
          onPress={handleConfirm}
          disabled={isConfirming || isExpired}
        >
          {isConfirming ? (
            <ActivityIndicator size="small" color={themeColors.background} />
          ) : (
            <Text style={styles.confirmText}>EXECUTE & COMMIT</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ticketCard: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      marginTop: spacing.sm,
      overflow: 'hidden',
    },
    ticketHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
    },
    ticketSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: '700',
    },
    ticketAction: {
      ...typography.caption,
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    timeBadge: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 2,
      backgroundColor: theme.background,
    },
    timeBadgeExpired: {
      borderColor: '#FF3B30',
      backgroundColor: '#FF3B3015',
    },
    timeText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      fontFamily: 'monospace',
    },
    timeTextExpired: {
      color: '#FF3B30',
    },
    summaryBar: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      backgroundColor: theme.card || theme.surface,
    },
    summaryText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 12,
      fontStyle: 'italic',
    },
    specsTable: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    specRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    specDivider: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    specLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    specValue: {
      ...typography.caption,
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
    },
    monoVal: {
      fontFamily: 'monospace',
      fontWeight: '700',
    },
    errorBox: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: '#FF3B3015',
      borderTopWidth: 1,
      borderTopColor: '#FF3B3040',
    },
    errorText: {
      ...typography.caption,
      color: '#FF3B30',
      fontSize: 11,
    },
    buttonDeck: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderRightWidth: 1,
      borderRightColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
    },
    cancelText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 1,
    },
    confirmButton: {
      flex: 1.3,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.text,
    },
    confirmText: {
      ...typography.caption,
      color: theme.background,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 1,
    },
    disabledBtn: {
      opacity: 0.4,
    },
  });
