import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../hooks/useThemeColors';
import { typography } from '../theme/typography';
export default function SplashScreen() {
    const themeColors = useThemeColors();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
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
        borderRadius: 30, // Squircle-ish
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
        fontFamily: typography.fontFamily.bold, // Assuming this exists
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: 1,
        fontFamily: typography.fontFamily.medium,
    },
});
