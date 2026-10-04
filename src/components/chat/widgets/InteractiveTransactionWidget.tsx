/**
 * InteractiveTransactionWidget — Generative UI Actionable Transaction Ticket
 *
 * Displays a structured financial proposal with direct 1-tap ledger confirmation,
 * vault tagging, category badges, and dynamic status updates.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { lightHaptic, heavyHaptic, mediumHaptic } from '../../../services/haptics/hapticFeedback';
import { useAIChatStore } from '../../../store/aiChatStore';

interface InteractiveTransactionWidgetProps {
  transaction: {
    type: 'income' | 'expense';
    amount: number;
    currency: string;
    categoryName: string;
    vaultType: string;
    date: string;
    description: string;
  };
  pendingActionId?: string;
}

export const InteractiveTransactionWidget: React.FC<InteractiveTransactionWidgetProps> = ({
  transaction,
  pendingActionId,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const { getPendingAction, confirmAction, cancelAction } = useAIChatStore();
  const pendingAction = pendingActionId ? getPendingAction(pendingActionId) : undefined;

  const [isExecuting, setIsExecuting] = useState(false);

  const status = pendingAction?.status || 'pending';
  const isIncome = transaction.type === 'income';

  const handleConfirm = useCallback(async () => {
    if (!pendingActionId || isExecuting || status !== 'pending') return;
    heavyHaptic();
    setIsExecuting(true);
    try {
      await confirmAction(pendingActionId);
    } catch (err) {
      console.error('[InteractiveTransactionWidget] Confirmation failed:', err);
    } finally {
      setIsExecuting(false);
    }
  }, [pendingActionId, isExecuting, status, confirmAction]);

  const handleCancel = useCallback(() => {
    if (!pendingActionId || isExecuting || status !== 'pending') return;
    mediumHaptic();
    cancelAction(pendingActionId);
  }, [pendingActionId, isExecuting, status, cancelAction]);

  return (
    <View style={[styles.card, status === 'confirmed' && styles.cardConfirmed]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: isIncome ? themeColors.success + '20' : themeColors.error + '20' },
            ]}
          >
            <MaterialCommunityIcons
              name={isIncome ? 'arrow-down-left' : 'arrow-up-right'}
              size={12}
              color={isIncome ? themeColors.success : themeColors.error}
            />
            <Text
              style={[
                styles.typeText,
                { color: isIncome ? themeColors.success : themeColors.error },
              ]}
            >
              {isIncome ? 'INCOMING' : 'EXPENSE TICKET'}
            </Text>
          </View>

          <View style={styles.vaultBadge}>
            <MaterialCommunityIcons name="safe" size={10} color={themeColors.textSecondary} />
            <Text style={styles.vaultText}>{(transaction.vaultType || 'main').toUpperCase()}</Text>
          </View>
        </View>

        {status === 'confirmed' ? (
          <View style={styles.statusConfirmed}>
            <MaterialCommunityIcons name="check-circle" size={14} color={themeColors.success} />
            <Text style={styles.statusTextConfirmed}>COMMITTED</Text>
          </View>
        ) : status === 'cancelled' ? (
          <View style={styles.statusCancelled}>
            <Text style={styles.statusTextCancelled}>VOID</Text>
          </View>
        ) : (
          <Text style={styles.dateText}>{transaction.date}</Text>
        )}
      </View>

      {/* Main Amount & Description */}
      <View style={styles.amountContainer}>
        <Text
          style={[
            styles.amount,
            { color: isIncome ? themeColors.success : themeColors.text },
          ]}
        >
          {isIncome ? '+' : '-'}
          {transaction.amount.toFixed(2)}
          <Text style={styles.currency}> {transaction.currency}</Text>
        </Text>

        <Text style={styles.description} numberOfLines={1}>
          {transaction.description || transaction.categoryName}
        </Text>
      </View>

      {/* Details Row */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="tag-outline" size={12} color={themeColors.textSecondary} />
          <Text style={styles.detailText}>{transaction.categoryName}</Text>
        </View>

        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="calendar-month-outline" size={12} color={themeColors.textSecondary} />
          <Text style={styles.detailText}>{transaction.date}</Text>
        </View>
      </View>

      {/* Action Buttons (Only when pending) */}
      {status === 'pending' && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn]}
            onPress={handleCancel}
            disabled={isExecuting}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>DISMISS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.confirmBtn]}
            onPress={handleConfirm}
            disabled={isExecuting}
            activeOpacity={0.7}
          >
            {isExecuting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <MaterialCommunityIcons name="check-bold" size={14} color="#000" />
                <Text style={styles.confirmBtnText}>COMMIT TO LEDGER</Text>
              </>
            )}
          </TouchableOpacity>
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
    cardConfirmed: {
      borderColor: themeColors.success + '40',
      backgroundColor: themeColors.success + '08',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      gap: 4,
    },
    typeText: {
      ...typography.caption,
      fontWeight: '800',
      fontSize: 9,
      letterSpacing: 0.5,
    },
    vaultBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      gap: 3,
    },
    vaultText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 9,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    dateText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 10,
    },
    statusConfirmed: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statusTextConfirmed: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 10,
      fontWeight: '800',
      color: themeColors.success,
      letterSpacing: 0.5,
    },
    statusCancelled: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: themeColors.surface,
    },
    statusTextCancelled: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 9,
      color: themeColors.textSecondary,
    },
    amountContainer: {
      marginVertical: spacing.xs,
    },
    amount: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    currency: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    description: {
      ...typography.body,
      color: themeColors.text,
      fontSize: 12,
      marginTop: 2,
      fontWeight: '500',
    },
    detailsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xs,
      paddingTop: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: themeColors.border,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    detailText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontSize: 10,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      gap: 6,
    },
    cancelBtn: {
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    cancelBtnText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 10,
      fontWeight: '700',
      color: themeColors.textSecondary,
    },
    confirmBtn: {
      flex: 1,
      backgroundColor: themeColors.primary,
    },
    confirmBtnText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 10,
      fontWeight: '800',
      color: '#000',
      letterSpacing: 0.5,
    },
  });
