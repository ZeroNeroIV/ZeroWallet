/**
 * Purpose: Chat input field with send button for composing messages
 *
 * Inputs:
 *   - onSend (function): Callback when user sends a message, receives text string
 *   - isLoading (boolean): Whether AI is currently responding
 *   - placeholder (string): Placeholder text for input field
 *
 * Outputs:
 *   - Returns (JSX.Element): Multiline input with send button
 *
 * Side effects:
 *   - Auto-focuses input on component mount
 *   - Clears input after sending message
 *   - Triggers haptic feedback on send
 *   - Grows input height up to 4 lines
 */

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { mediumHaptic } from '../../services/haptics/hapticFeedback';

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading = false,
  placeholder = 'Ask about your finances...',
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const canSend = text.trim().length > 0 && !isLoading;

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Handle send message
  const handleSend = useCallback(() => {
    if (!canSend) return;

    mediumHaptic();
    const messageText = text.trim();
    setText(''); // Clear input
    setInputHeight(0); // Reset height
    onSend(messageText);

    // Re-focus input after sending
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [text, canSend, onSend]);

  // Handle text change
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
  }, []);

  // Handle content size change (auto-grow)
  const handleContentSizeChange = useCallback(
    (event: any) => {
      const { height } = event.nativeEvent.contentSize;
      const maxHeight = LINE_HEIGHT * MAX_LINES + VERTICAL_PADDING;
      const minHeight = LINE_HEIGHT + VERTICAL_PADDING;

      if (height <= minHeight) {
        setInputHeight(0); // Use default height
      } else if (height <= maxHeight) {
        setInputHeight(height);
      } else {
        setInputHeight(maxHeight); // Cap at max height
      }
    },
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            inputHeight > 0 && { height: inputHeight },
          ]}
          value={text}
          onChangeText={handleTextChange}
          onContentSizeChange={handleContentSizeChange}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textSecondary}
          multiline
          maxLength={1000}
          editable={!isLoading}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            !canSend && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="send"
            size={24}
            color={canSend ? themeColors.neutral.white : themeColors.textDisabled}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Constants for input sizing
const LINE_HEIGHT = 20;
const MAX_LINES = 4;
const VERTICAL_PADDING = spacing.md * 2; // Top + bottom padding

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: themeColors.background,
      borderTopWidth: 1,
      borderTopColor: themeColors.border,
    },

    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: themeColors.border,
      paddingLeft: spacing.md,
      paddingRight: spacing.xs,
      paddingVertical: spacing.xs,
    },

    input: {
      flex: 1,
      ...typography.body,
      color: themeColors.text,
      minHeight: LINE_HEIGHT + spacing.md * 2,
      maxHeight: LINE_HEIGHT * MAX_LINES + spacing.md * 2,
      paddingTop: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
      paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
      paddingHorizontal: 0,
      lineHeight: LINE_HEIGHT,
      textAlignVertical: 'center',
    },

    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: themeColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: spacing.sm,
    },
    sendButtonDisabled: {
      backgroundColor: themeColors.border,
    },
  });
