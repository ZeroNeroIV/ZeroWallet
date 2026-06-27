/**
 * Purpose: Displays error state with retry functionality
 * 
 * Inputs:
 *   - title (string): Error title
 *   - message (string): Error description
 *   - onRetry (function): Optional retry callback
 *   - retryLabel (string): Optional custom retry button label
 * 
 * Outputs:
 *   - Returns (JSX.Element): Error state component
 * 
 * Side effects:
 *   - Triggers haptic feedback on retry
 *   - Calls onRetry callback when retry button pressed
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { mediumHaptic } from '../../services/haptics/hapticFeedback';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something Went Wrong',
  message = 'We encountered an error. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  style,
}) => {
  const handleRetry = () => {
    mediumHaptic();
    onRetry?.();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={64}
          color={colors.semantic.error}
        />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {onRetry && (
        <TouchableOpacity
          style={styles.button}
          onPress={handleRetry}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="refresh"
            size={20}
            color={colors.neutral.white}
          />
          <Text style={styles.buttonText}>{retryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Purpose: Network error state
 */
export const NetworkError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <ErrorState
    title="No Internet Connection"
    message="Please check your connection and try again"
    onRetry={onRetry}
  />
);

/**
 * Purpose: Database error state
 */
export const DatabaseError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <ErrorState
    title="Database Error"
    message="We couldn't load your data. Please try again."
    onRetry={onRetry}
  />
);

/**
 * Purpose: Permission error state
 */
export const PermissionError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <ErrorState
    title="Permission Denied"
    message="Please grant the necessary permissions to continue"
    onRetry={onRetry}
    retryLabel="Grant Permission"
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
    color: colors.neutral.gray600,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 300,
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.semantic.error,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.body,
    color: colors.neutral.white,
    fontWeight: '600',
  },
});
