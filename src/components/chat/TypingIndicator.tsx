/**
 * Purpose: Animated typing indicator showing AI is generating a response
 *
 * Inputs:
 *   - isVisible (boolean): Whether to show the indicator
 *
 * Outputs:
 *   - Returns (JSX.Element | null): Animated dots or null if not visible
 *
 * Side effects:
 *   - Animates three dots in a wave pattern using Reanimated 4 worklets
 *   - Fades in/out smoothly on the UI thread when visibility changes
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

interface TypingIndicatorProps {
  isVisible: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isVisible }) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  const containerOpacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      containerOpacity.value = withTiming(1, { duration: 200 });

      dot1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 400 })
        ),
        -1,
        false
      );

      dot2.value = withDelay(
        150,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0, { duration: 400 })
          ),
          -1,
          false
        )
      );

      dot3.value = withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0, { duration: 400 })
          ),
          -1,
          false
        )
      );
    } else {
      containerOpacity.value = withTiming(0, { duration: 200 });
      dot1.value = 0;
      dot2.value = 0;
      dot3.value = 0;
    }
  }, [isVisible, containerOpacity, dot1, dot2, dot3]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerOpacity.value }],
  }));

  const dot1Style = useAnimatedStyle(() => ({
    opacity: 0.3 + dot1.value * 0.7,
    transform: [{ scale: 1 + dot1.value * 0.2 }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    opacity: 0.3 + dot2.value * 0.7,
    transform: [{ scale: 1 + dot2.value * 0.2 }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    opacity: 0.3 + dot3.value * 0.7,
    transform: [{ scale: 1 + dot3.value * 0.2 }],
  }));

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.bubble}>
        <View style={styles.aiIconContainer}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={16}
            color={themeColors.primary}
          />
        </View>

        <Text style={styles.typingText}>AI is thinking</Text>

        <View style={styles.dotsContainer}>
          <Animated.View
            style={[styles.dot, { backgroundColor: themeColors.primary }, dot1Style]}
          />
          <Animated.View
            style={[styles.dot, { backgroundColor: themeColors.primary }, dot2Style]}
          />
          <Animated.View
            style={[styles.dot, { backgroundColor: themeColors.primary }, dot3Style]}
          />
        </View>
      </View>
    </Animated.View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      alignItems: 'flex-start',
    },
    bubble: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors.border,
      maxWidth: '80%',
    },
    aiIconContainer: {
      width: 24,
      height: 24,
      borderRadius: borderRadius.full,
      backgroundColor: themeColors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.xs,
    },
    typingText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      marginRight: spacing.sm,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs / 2,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
  });
