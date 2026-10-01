import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
} from 'react-native-reanimated';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../hooks/useThemeColors';
import { typography } from '../theme/typography';

export default function SplashScreen() {
    const themeColors = useThemeColors();
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.8);

    useEffect(() => {
        opacity.value = withTiming(1, { duration: 800 });
        scale.value = withSpring(1, { damping: 12, stiffness: 100 });
    }, [opacity, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    return (
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
            <Animated.View style={[styles.content, animatedStyle]}>
                <View style={[styles.iconContainer, { backgroundColor: themeColors.primary }]}>
                    <MaterialCommunityIcons name="wallet" size={64} color="#FFFFFF" />
                </View>
                <Text style={[styles.title, { color: themeColors.text }]}>W A L L E T</Text>
                <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                    Smart Money Tracking
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: 4,
        marginBottom: 8,
        fontFamily: typography.fontFamily.bold,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 1,
        fontFamily: typography.fontFamily.medium,
    },
});
