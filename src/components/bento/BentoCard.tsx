import React, { useRef, useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { spacing } from '../../theme/spacing';
import { useThemeColors } from '../../hooks/useThemeColors';

interface BentoCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
  onPress?: () => void;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  children,
  delay = 0,
  style,
  onPress,
}) => {
  const hasAnimated = useRef(false);
  const themeColors = useThemeColors();

  useEffect(() => {
    hasAnimated.current = true;
  }, []);

  const cardStyle = {
    backgroundColor: themeColors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    shadowColor: themeColors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  };

  return (
    <MotiView
      from={
        hasAnimated.current
          ? { opacity: 1, translateY: 0 }
          : { opacity: 0, translateY: 20 }
      }
      animate={{
        opacity: 1,
        translateY: 0,
      }}
      transition={{
        type: 'timing',
        duration: hasAnimated.current ? 0 : 400,
        delay: hasAnimated.current ? 0 : delay,
      }}
      style={[cardStyle, style]}
      onTouchEnd={onPress}
    >
      {children}
    </MotiView>
  );
};
