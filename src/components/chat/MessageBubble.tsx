/**
 * Purpose: Display individual chat message bubble with styling and copy functionality
 *
 * Inputs:
 *   - message (AIMessage): Message object containing content, role, timestamp
 *
 * Outputs:
 *   - Returns (JSX.Element): Styled message bubble (user or AI)
 *
 * Side effects:
 *   - Copies message text to clipboard on long press
 *   - Shows toast/alert confirmation when copied
 *   - Triggers haptic feedback on long press
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
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { mediumHaptic } from '../../services/haptics/hapticFeedback';
import { useAIChatStore } from '../../store/aiChatStore';
import { PendingActionCard } from './PendingActionCard';

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

  // Format timestamp
  const formattedTime = useMemo(() => {
    const date = new Date(message.timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
  }, [message.timestamp]);

  // Handle long press to copy message
  const handleLongPress = useCallback(() => {
    mediumHaptic();
    Clipboard.setString(message.content);
    Alert.alert('Copied', 'Message copied to clipboard');
  }, [message.content]);

  // Handle pending action confirmation
  const handleConfirmAction = useCallback(async (actionId: string) => {
    await confirmAction(actionId);
  }, [confirmAction]);

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      <TouchableOpacity
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
          message.isError && styles.errorBubble,
        ]}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
        delayLongPress={500}
      >
        {/* AI Icon */}
        {!isUser && (
          <View style={styles.aiIconContainer}>
            <MaterialCommunityIcons
              name="robot-outline"
              size={16}
              color={themeColors.primary}
            />
          </View>
        )}

        {/* Message Content */}
        <Text style={[styles.text, isUser ? styles.userText : styles.aiText]}>
          {message.content}
        </Text>

        {/* Timestamp */}
        <Text
          style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.aiTimestamp,
          ]}
        >
          {formattedTime}
        </Text>

        {/* Error Indicator */}
        {message.isError && (
          <View style={styles.errorIndicator}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={14}
              color={themeColors.error}
            />
            <Text style={styles.errorText}>Failed to send</Text>
          </View>
        )}

        {/* Function Calls Debug (optional) */}
        {message.functionCalls && message.functionCalls.length > 0 && (
          <View style={styles.functionsDebug}>
            <MaterialCommunityIcons
              name="function"
              size={12}
              color={themeColors.textSecondary}
            />
            <Text style={styles.functionsText}>
              Called: {message.functionCalls.join(', ')}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Pending Action Card */}
      {pendingAction && pendingAction.status === 'pending' && !isUser && (
        <View style={styles.pendingActionContainer}>
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

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    // Container
    container: {
      width: '100%',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      alignItems: 'stretch', // Allow children to fill width
    },
    userContainer: {
      alignItems: 'flex-end',
    },
    aiContainer: {
      alignItems: 'flex-start',
    },

    // Bubble
    bubble: {
      maxWidth: '80%',
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      position: 'relative',
    },
    userBubble: {
      backgroundColor: themeColors.primary,
      borderBottomRightRadius: spacing.xs,
    },
    aiBubble: {
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderBottomLeftRadius: spacing.xs,
    },
    errorBubble: {
      backgroundColor: themeColors.isDark
        ? `${themeColors.error}20`
        : `${themeColors.error}10`,
      borderColor: themeColors.error,
    },

    // AI Icon
    aiIconContainer: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: `${themeColors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Text
    text: {
      ...typography.body,
      lineHeight: 22,
    },
    userText: {
      color: themeColors.neutral.white,
    },
    aiText: {
      color: themeColors.text,
      paddingLeft: spacing.lg + spacing.sm, // Make room for AI icon
    },

    // Timestamp
    timestamp: {
      ...typography.caption,
      marginTop: spacing.xs,
    },
    userTimestamp: {
      color: themeColors.neutral.white,
      opacity: 0.8,
      textAlign: 'right',
    },
    aiTimestamp: {
      color: themeColors.textSecondary,
      textAlign: 'left',
      paddingLeft: spacing.lg + spacing.sm, // Align with message text
    },

    // Error Indicator
    errorIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    errorText: {
      ...typography.caption,
      color: themeColors.error,
      fontWeight: typography.fontWeight.medium,
    },

    // Functions Debug
    functionsDebug: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: themeColors.border,
    },
    functionsText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontStyle: 'italic',
      flex: 1,
    },

    // Pending Action Container
    pendingActionContainer: {
      width: '100%',
      marginTop: spacing.sm,
      alignSelf: 'stretch',
    },
  });
