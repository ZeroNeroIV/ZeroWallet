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
 *   - Animates three dots in a wave pattern
 *   - Fades in/out smoothly when visibility changes
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
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

  // Animated values for each dot
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animate dots in a wave pattern
  useEffect(() => {
    if (isVisible) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Create staggered animation for each dot
      const createDotAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        );
      };

      // Start animations with stagger
      const animations = [
        createDotAnimation(dot1Anim, 0),
        createDotAnimation(dot2Anim, 150),
        createDotAnimation(dot3Anim, 300),
      ];

      animations.forEach((anim) => anim.start());

      return () => {
        animations.forEach((anim) => anim.stop());
        dot1Anim.setValue(0);
        dot2Anim.setValue(0);
        dot3Anim.setValue(0);
      };
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, dot1Anim, dot2Anim, dot3Anim, fadeAnim]);

  if (!isVisible) {
    return null;
  }

  // Interpolate opacity for each dot
  const dot1Opacity = dot1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const dot2Opacity = dot2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const dot3Opacity = dot3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  // Interpolate scale for each dot
  const dot1Scale = dot1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  const dot2Scale = dot2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  const dot3Scale = dot3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: fadeAnim }],
        },
      ]}
    >
      <View style={styles.bubble}>
        {/* AI Icon */}
        <View style={styles.aiIconContainer}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={16}
            color={themeColors.primary}
          />
        </View>

        {/* Typing text */}
        <Text style={styles.typingText}>AI is thinking</Text>

        {/* Animated dots */}
        <View style={styles.dotsContainer}>
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot1Opacity,
                transform: [{ scale: dot1Scale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot2Opacity,
                transform: [{ scale: dot2Scale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot3Opacity,
                transform: [{ scale: dot3Scale }],
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      alignItems: 'flex-start',
    },

    bubble: {
      maxWidth: '80%',
      borderRadius: borderRadius.lg,
      borderBottomLeftRadius: spacing.xs,
      padding: spacing.md,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },

    aiIconContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: `${themeColors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
    },

    typingText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      fontStyle: 'italic',
    },

    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs / 2,
      marginLeft: spacing.xs,
    },

    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: themeColors.primary,
    },
  });
