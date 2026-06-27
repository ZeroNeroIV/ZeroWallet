/**
 * Purpose: Displays loading indicator with optional message
 * 
 * Inputs:
 *   - visible (boolean): Whether loading overlay is visible
 *   - message (string): Optional loading message
 *   - transparent (boolean): Whether background is transparent
 * 
 * Outputs:
 *   - Returns (JSX.Element | null): Loading overlay or null
 * 
 * Side effects: None (pure component)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  transparent?: boolean;
  style?: ViewStyle;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message,
  transparent = false,
  style,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.container, transparent && styles.transparentBg]}>
        <View style={[styles.content, style]}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
};

/**
 * Purpose: Inline loading indicator (not modal)
 */
export const LoadingIndicator: React.FC<{
  message?: string;
  size?: 'small' | 'large';
  style?: ViewStyle;
}> = ({ message, size = 'large', style }) => (
  <View style={[styles.inlineContainer, style]}>
    <ActivityIndicator size={size} color={colors.primary.main} />
    {message && <Text style={styles.inlineMessage}>{message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transparentBg: {
    backgroundColor: 'transparent',
  },
  content: {
    backgroundColor: colors.neutral.white,
    padding: spacing.xl,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 150,
  },
  message: {
    ...typography.body,
    color: colors.neutral.gray700,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  inlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  inlineMessage: {
    ...typography.body,
    color: colors.neutral.gray600,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
