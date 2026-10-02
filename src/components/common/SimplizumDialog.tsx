/**
 * SimplizumDialog — Architectural Centered Dialog & Prompt Modal
 *
 * Replaces native OS alert/prompt popups with a bespoke Simplizum UI:
 * - 1px razor-thin outlines
 * - 2px subtle corners
 * - Centered architectural card with monospace category super-tags
 * - Split 50/50 horizontal button deck (Cancel outline + Solid Confirm)
 * - Interactive input prompt support
 * - Tactile haptic feedback
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Pressable,
} from 'react-native';
import { useDialogStore, type DialogButton } from '../../store/dialogStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic, mediumHaptic, heavyHaptic } from '../../services/haptics/hapticFeedback';

export const SimplizumDialog: React.FC = () => {
  const { isOpen, config, promptValue, setPromptValue, closeDialog } = useDialogStore();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  if (!isOpen || !config) return null;

  const isDestructive =
    config.variant === 'destructive' ||
    config.buttons?.some((b) => b.style === 'destructive');

  const handleButtonPress = (button: DialogButton) => {
    if (button.style === 'destructive') {
      heavyHaptic();
    } else if (button.style === 'cancel') {
      lightHaptic();
    } else {
      mediumHaptic();
    }

    closeDialog();
    if (button.onPress) {
      // Pass prompt value if this was a prompt dialog
      button.onPress(config.type === 'prompt' ? promptValue : undefined);
    }
  };

  const handleBackdropPress = () => {
    if (config.cancelable !== false) {
      lightHaptic();
      // Look for a cancel button first
      const cancelBtn = config.buttons?.find((b) => b.style === 'cancel');
      if (cancelBtn?.onPress) {
        cancelBtn.onPress();
      }
      closeDialog();
    }
  };

  const renderButtons = () => {
    const buttons = config.buttons || [{ text: 'OK', style: 'default' }];

    if (buttons.length === 1) {
      const b = buttons[0];
      const isDestr = b.style === 'destructive' || isDestructive;
      return (
        <View style={styles.singleButtonContainer}>
          <TouchableOpacity
            style={[styles.fullWidthButton, isDestr ? styles.destructiveButton : null]}
            onPress={() => handleButtonPress(b)}
            activeOpacity={0.8}
          >
            <Text style={[styles.fullWidthButtonText, isDestr ? styles.whiteText : null]}>
              {b.text.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (buttons.length === 2) {
      // 50/50 Split Horizontal Deck (Cancel left, Action right)
      const [leftBtn, rightBtn] =
        buttons[0].style === 'cancel'
          ? [buttons[0], buttons[1]]
          : buttons[1].style === 'cancel'
          ? [buttons[1], buttons[0]]
          : [buttons[0], buttons[1]];

      const isRightDestructive = rightBtn.style === 'destructive' || isDestructive;

      return (
        <View style={styles.splitButtonDeck}>
          <TouchableOpacity
            style={styles.deckCancelButton}
            onPress={() => handleButtonPress(leftBtn)}
            activeOpacity={0.7}
          >
            <Text style={styles.deckCancelText}>{leftBtn.text.toUpperCase()}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deckConfirmButton, isRightDestructive ? styles.destructiveButton : null]}
            onPress={() => handleButtonPress(rightBtn)}
            activeOpacity={0.8}
          >
            <Text style={[styles.deckConfirmText, isRightDestructive ? styles.whiteText : null]}>
              {rightBtn.text.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 3 or more buttons: Vertical stacked list
    return (
      <View style={styles.stackedButtonContainer}>
        {buttons.map((b, idx) => {
          const isCancel = b.style === 'cancel';
          const isDestr = b.style === 'destructive';
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.stackedButton,
                idx > 0 && styles.stackedButtonDivider,
                isDestr && styles.destructiveButton,
                isCancel && styles.stackedCancelButton,
              ]}
              onPress={() => handleButtonPress(b)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.stackedButtonText,
                  isDestr ? styles.whiteText : isCancel ? styles.cancelText : null,
                ]}
              >
                {b.text.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Pressable
          style={[styles.dialogCard, isDestructive ? styles.destructiveCard : null]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.superTag, isDestructive ? styles.destructiveSuper : null]}>
              {config.superTag || 'SYSTEM NOTICE'}
            </Text>
            <Text style={styles.title}>{config.title}</Text>
          </View>

          {/* Body Message */}
          {Boolean(config.message) && (
            <ScrollView
              style={styles.messageScrollView}
              contentContainerStyle={styles.messageContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.messageText}>{config.message}</Text>
            </ScrollView>
          )}

          {/* Interactive Input Prompt */}
          {config.type === 'prompt' && (
            <View style={styles.promptInputArea}>
              <TextInput
                style={styles.promptTextInput}
                value={promptValue}
                onChangeText={setPromptValue}
                placeholder={config.promptPlaceholder || 'Enter input...'}
                placeholderTextColor={themeColors.textSecondary}
                secureTextEntry={config.promptSecureTextEntry}
                keyboardType={config.promptKeyboardType || 'default'}
                autoCapitalize={config.promptAutoCapitalize || 'none'}
                autoFocus
              />
            </View>
          )}

          {/* Button Deck */}
          {renderButtons()}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    dialogCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.card || theme.surface,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    destructiveCard: {
      borderColor: '#FF3B30',
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
    },
    superTag: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      letterSpacing: 1.5,
      fontWeight: '700',
      marginBottom: 3,
      fontFamily: 'monospace',
    },
    destructiveSuper: {
      color: '#FF3B30',
    },
    title: {
      ...typography.h3,
      color: theme.text,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    messageScrollView: {
      maxHeight: 220,
    },
    messageContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
    },
    messageText: {
      ...typography.body,
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    promptInputArea: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    promptTextInput: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      color: theme.text,
      borderRadius: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      fontFamily: 'monospace',
    },
    // Single Button
    singleButtonContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    fullWidthButton: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.text,
    },
    fullWidthButtonText: {
      ...typography.caption,
      color: theme.background,
      fontWeight: '700',
      letterSpacing: 1,
      fontSize: 11,
    },
    // Split 50/50 Deck
    splitButtonDeck: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    deckCancelButton: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRightWidth: 1,
      borderRightColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
    },
    deckCancelText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontWeight: '700',
      letterSpacing: 1,
      fontSize: 11,
    },
    deckConfirmButton: {
      flex: 1.1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.text,
    },
    deckConfirmText: {
      ...typography.caption,
      color: theme.background,
      fontWeight: '700',
      letterSpacing: 1,
      fontSize: 11,
    },
    // Stacked
    stackedButtonContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    stackedButton: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.text,
    },
    stackedButtonDivider: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    stackedCancelButton: {
      backgroundColor: theme.background,
    },
    stackedButtonText: {
      ...typography.caption,
      color: theme.background,
      fontWeight: '700',
      letterSpacing: 1,
      fontSize: 11,
    },
    cancelText: {
      color: theme.textSecondary,
    },
    destructiveButton: {
      backgroundColor: '#FF3B30',
    },
    whiteText: {
      color: '#FFFFFF',
    },
  });
