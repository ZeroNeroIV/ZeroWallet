/**
 * Purpose: Custom splash screen component for app initialization
 *
 * Inputs:
 *   - onFinish (function): Callback when initialization is complete
 *
 * Outputs:
 *   - Returns (JSX.Element): Animated splash screen with logo and loading indicator
 *
 * Side effects:
 *   - Displays during app initialization
 *   - Fades out after minimum display time
 *   - Calls onFinish callback when animation complete
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Image, ImageStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

interface SplashScreenProps {
  onFinish?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 600 });
    opacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withDelay(
        1000,
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished && onFinish) {
            runOnJS(onFinish)();
          }
        })
      )
    );
  }, [onFinish, opacity, scale]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
        <Image
          source={require('../../../wallet.png')}
          style={styles.logo as ImageStyle}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
});
