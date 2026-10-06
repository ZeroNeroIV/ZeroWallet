/**
 * MessageBubble — Simplizum Architectural Ledger Message
 *
 * Razor-thin hairline message cells:
 *  - Subtle right-aligned user frames with monospace timestamps
 *  - Structured left-aligned assistant blocks with system metadata
 *  - Embedded inline mutation tickets (PendingActionCard)
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { AIMessage } from '../../types/ai';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic } from '../../services/haptics/hapticFeedback';
import { useAIChatStore } from '../../store/aiChatStore';
import { PendingActionCard } from './PendingActionCard';
import { InteractiveChartWidget } from './widgets/InteractiveChartWidget';
import { InteractiveTransactionWidget } from './widgets/InteractiveTransactionWidget';
import { FinancialInsightWidget } from './widgets/FinancialInsightWidget';

interface MessageBubbleProps {
  message: AIMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const { getPendingAction, confirmAction, cancelAction } = useAIChatStore();
  const pendingAction = message.pendingActionId
    ? getPendingAction(message.pendingActionId)
    : undefined;

  const isUser = message.role === 'user';

  const formattedTime = useMemo(() => {
    const date = new Date(message.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }, [message.timestamp]);

  const handleLongPress = useCallback(() => {
    lightHaptic();
    Clipboard.setString(message.content);
    Alert.alert('COPIED', 'Message content copied to clipboard.');
  }, [message.content]);

  const handleConfirmAction = useCallback(
    async (actionId: string) => {
      await confirmAction(actionId);
    },
    [confirmAction]
  );

  return (
    <View style={[styles.wrapper, isUser ? styles.userWrapper : styles.aiWrapper]}>
      <TouchableOpacity
        style={[
          styles.cell,
          isUser ? styles.userCell : styles.aiCell,
          message.isError ? styles.errorCell : null,
        ]}
        onLongPress={handleLongPress}
        activeOpacity={0.85}
        delayLongPress={400}
      >
        {/* Cell Header Tag */}
        <View style={styles.cellHeader}>
          <Text style={styles.cellSuper}>
            {isUser
              ? `USER COMMAND · ${formattedTime}`
              : message.engineBadge
              ? `${message.engineBadge.toUpperCase()} · ${formattedTime}`
              : `AI COPILOT · ${formattedTime}`}
          </Text>
        </View>

        {/* Message Content */}
        <Text style={[styles.bodyText, message.isError ? styles.errorText : null]}>
          {message.content}
        </Text>

        {/* Debug Function Calls if any */}
        {message.functionCalls && message.functionCalls.length > 0 && (
          <View style={styles.debugRow}>
            <MaterialCommunityIcons name="function" size={12} color={themeColors.textSecondary} />
            <Text style={styles.debugText}>
              DISPATCH: {message.functionCalls.join(', ').toUpperCase()}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Generative UI Widgets */}
      {message.widgets && message.widgets.length > 0 && !isUser && (
        <View style={styles.widgetsWrap}>
          {message.widgets.map((widget, idx) => {
            if (widget.type === 'chart') {
              return (
                <InteractiveChartWidget
                  key={`chart-${idx}`}
                  chartType={widget.chartType}
                  title={widget.title}
                  data={widget.data}
                  summary={widget.summary}
                  total={widget.total}
                  currency={widget.currency}
                />
              );
            }
            if (widget.type === 'transaction_proposal') {
              return (
                <InteractiveTransactionWidget
                  key={`tx-${idx}`}
                  transaction={widget.transaction}
                  pendingActionId={widget.pendingActionId}
                />
              );
            }
            if (widget.type === 'health_score') {
              return (
                <FinancialInsightWidget
                  key={`health-${idx}`}
                  score={widget.score}
                  grade={widget.grade}
                  runwayMonths={widget.runwayMonths}
                  savingsRate={widget.savingsRate}
                  burnRate={widget.burnRate}
                  recommendations={widget.recommendations}
                />
              );
            }
            return null;
          })}
        </View>
      )}

      {/* Fallback Pending Action Card if no transaction widget already rendered */}
      {pendingAction &&
        pendingAction.status === 'pending' &&
        !isUser &&
        !message.widgets?.some((w) => w.type === 'transaction_proposal') && (
          <View style={styles.pendingActionWrap}>
            <PendingActionCard
              action={pendingAction}
              onConfirm={handleConfirmAction}
              onCancel={cancelAction}
            />
          </View>
        )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      marginBottom: spacing.sm + 4,
    },
    userWrapper: {
      alignItems: 'flex-end',
    },
    aiWrapper: {
      alignItems: 'flex-start',
    },
    cell: {
      maxWidth: '88%',
      borderWidth: 1,
      borderRadius: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    userCell: {
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
    },
    aiCell: {
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderLeftWidth: 2,
      borderLeftColor: theme.text,
    },
    errorCell: {
      borderColor: '#FF3B30',
      backgroundColor: '#FF3B3010',
      borderLeftColor: '#FF3B30',
    },
    cellHeader: {
      marginBottom: 4,
    },
    cellSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      fontFamily: 'monospace',
    },
    bodyText: {
      ...typography.body,
      color: theme.text,
      fontSize: 13,
      lineHeight: 19,
    },
    errorText: {
      color: '#FF3B30',
    },
    debugRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    debugText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      fontFamily: 'monospace',
      letterSpacing: 0.5,
    },
    pendingActionWrap: {
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'stretch',
      marginTop: 4,
    },
    widgetsWrap: {
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'stretch',
      marginTop: 6,
    },
  });
