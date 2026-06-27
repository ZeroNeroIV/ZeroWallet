import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
    FadeIn,
    FadeOut,
    BounceIn,
    ZoomIn,
} from 'react-native-reanimated';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Goal } from '../../types/models';

interface GoalCompletionModalProps {
    goal: Goal | null;
    visible: boolean;
    onMarkComplete: () => void;
    onCreateNew: () => void;
    onClose: () => void;
}

export const GoalCompletionModal: React.FC<GoalCompletionModalProps> = ({
    goal,
    visible,
    onMarkComplete,
    onCreateNew,
    onClose,
}) => {
    const themeColors = useThemeColors();
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    if (!goal) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Animated.View
                    entering={FadeIn}
                    exiting={FadeOut}
                    style={styles.backdrop}
                >
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={onClose}
                    />
                </Animated.View>

                <Animated.View
                    entering={BounceIn.delay(100)}
                    style={styles.modalContainer}
                >
                    {/* Confetti Icons */}
                    <View style={styles.confettiContainer}>
                        <Animated.Text entering={ZoomIn.delay(200)} style={styles.confetti}>
                            🎉
                        </Animated.Text>
                        <Animated.Text entering={ZoomIn.delay(300)} style={styles.confetti}>
                            🎊
                        </Animated.Text>
                        <Animated.Text entering={ZoomIn.delay(400)} style={styles.confetti}>
                            ✨
                        </Animated.Text>
                    </View>

                    {/* Goal Icon */}
                    <View
                        style={[
                            styles.goalIcon,
                            { backgroundColor: goal.color + '20' },
                        ]}
                    >
                        <Text style={styles.goalIconText}>{goal.icon}</Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>Goal Reached! 🎯</Text>

                    {/* Goal Name */}
                    <Text style={styles.goalName}>{goal.name}</Text>

                    {/* Amount */}
                    {goal.targetAmount && (
                        <Text style={styles.amount}>
                            ${goal.targetAmount.toFixed(2)}
                        </Text>
                    )}

                    {/* Message */}
                    <Text style={styles.message}>
                        Congratulations! You've reached your goal.{'\n'}
                        You can buy it now! 🛍️
                    </Text>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.primaryButton,
                                { backgroundColor: themeColors.success },
                            ]}
                            onPress={onMarkComplete}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons
                                name="check-circle"
                                size={20}
                                color="#FFFFFF"
                            />
                            <Text style={styles.primaryButtonText}>Mark as Complete</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.secondaryButton,
                                { borderColor: themeColors.border },
                            ]}
                            onPress={onCreateNew}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons
                                name="plus-circle-outline"
                                size={20}
                                color={themeColors.primary}
                            />
                            <Text style={[styles.secondaryButtonText, { color: themeColors.text }]}>
                                Create New Goal
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.closeButtonText, { color: themeColors.textSecondary }]}>
                                Close
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const { width } = Dimensions.get('window');

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
        },
        modalContainer: {
            width: width * 0.85,
            maxWidth: 400,
            backgroundColor: themeColors.surface,
            borderRadius: 24,
            padding: spacing.xl,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: themeColors.border,
        },
        confettiContainer: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            width: '100%',
            marginBottom: spacing.md,
        },
        confetti: {
            fontSize: 32,
        },
        goalIcon: {
            width: 80,
            height: 80,
            borderRadius: 40,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
        },
        goalIconText: {
            fontSize: 40,
        },
        title: {
            ...typography.h2,
            fontWeight: '700',
            color: themeColors.text,
            marginBottom: spacing.sm,
            textAlign: 'center',
        },
        goalName: {
            ...typography.h3,
            fontWeight: '600',
            color: themeColors.textSecondary,
            marginBottom: spacing.md,
            textAlign: 'center',
        },
        amount: {
            ...typography.h1,
            fontSize: 36,
            fontWeight: '700',
            color: themeColors.success,
            marginBottom: spacing.md,
        },
        message: {
            ...typography.body,
            color: themeColors.textSecondary,
            textAlign: 'center',
            marginBottom: spacing.xl,
            lineHeight: 22,
        },
        actions: {
            width: '100%',
            gap: spacing.md,
        },
        button: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: 12,
            gap: spacing.sm,
        },
        primaryButton: {
            backgroundColor: '#10b981',
        },
        primaryButtonText: {
            ...typography.body,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        secondaryButton: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
        },
        secondaryButtonText: {
            ...typography.body,
            fontWeight: '600',
        },
        closeButton: {
            paddingVertical: spacing.sm,
            alignItems: 'center',
        },
        closeButtonText: {
            ...typography.body,
            fontWeight: '500',
        },
    });
