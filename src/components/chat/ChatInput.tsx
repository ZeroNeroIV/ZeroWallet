/**
 * ChatInput — Simplizum Hairline Floating Command Bar
 *
 * 1px outlined input container with auto-expanding text field,
 * dynamic send trigger, and live voice call button.
 */

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { mediumHaptic } from '../../services/haptics/hapticFeedback';

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  engineName?: string;
  onStartVoiceCall?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading = false,
  placeholder = 'Type financial query or command...',
  onStartVoiceCall,
}) => {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors, insets), [themeColors, insets]);

  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const canSend = text.trim().length > 0 && !isLoading;

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    mediumHaptic();
    const msg = text.trim();
    setText('');
    setInputHeight(0);
    onSend(msg);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [text, canSend, onSend]);

  const handleVoiceCallPress = useCallback(() => {
    mediumHaptic();
    if (onStartVoiceCall) {
      onStartVoiceCall();
    }
  }, [onStartVoiceCall]);

  const handleContentSizeChange = useCallback((event: any) => {
    const { height } = event.nativeEvent.contentSize;
    const maxHeight = LINE_HEIGHT * MAX_LINES + 16;
    const minHeight = LINE_HEIGHT + 16;

    if (height <= minHeight) {
      setInputHeight(0);
    } else if (height <= maxHeight) {
      setInputHeight(height);
    } else {
      setInputHeight(maxHeight);
    }
  }, []);

  return (
    <View style={styles.dock}>
      <View style={styles.inputContainer}>
        {/* Terminal chevron prefix */}
        <View style={styles.promptPrefix}>
          <MaterialCommunityIcons name="chevron-right" size={16} color={themeColors.primary} />
        </View>

        <TextInput
          ref={inputRef}
          style={[styles.input, inputHeight > 0 && { height: inputHeight }]}
          value={text}
          onChangeText={setText}
          onContentSizeChange={handleContentSizeChange}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textSecondary}
          multiline
          maxLength={1000}
          editable={!isLoading}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {/* Action Trigger: Send or Live Voice Call */}
        {canSend ? (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="arrow-up"
              size={18}
              color={themeColors.background}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.voiceButton}
            onPress={handleVoiceCallPress}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="microphone"
              size={18}
              color={themeColors.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const LINE_HEIGHT = 20;
const MAX_LINES = 4;

const createStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    dock: {
      paddingHorizontal: spacing.sm + 4,
      paddingTop: spacing.xs + 2,
      paddingBottom: Math.max(insets?.bottom || 0, 10),
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 4,
      paddingLeft: 6,
      paddingRight: 4,
      paddingVertical: 3,
    },
    promptPrefix: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    input: {
      flex: 1,
      ...typography.body,
      color: theme.text,
      minHeight: LINE_HEIGHT + 14,
      maxHeight: LINE_HEIGHT * MAX_LINES + 14,
      paddingTop: Platform.OS === 'ios' ? spacing.xs : 2,
      paddingBottom: Platform.OS === 'ios' ? spacing.xs : 2,
      paddingHorizontal: spacing.xs,
      lineHeight: LINE_HEIGHT,
      fontSize: 13,
    },
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 2,
      backgroundColor: theme.text,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    voiceButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.card || theme.surface,
      borderWidth: 1,
      borderColor: theme.primary + '50',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
  });
