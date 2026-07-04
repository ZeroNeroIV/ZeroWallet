import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withTiming,
    interpolate,
} from 'react-native-reanimated';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Goal } from '../../types/models';
import {
    calculateGoalPercentage,
    getProgressColor,
    getRemainingAmount,
    projectGoalPayoff,
} from '../../utils/goalUtils';

interface GoalCardProps {
    goal: Goal;
    onPress: () => void;
    onLongPress?: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
    goal,
    onPress,
    onLongPress,
}) => {
    const themeColors = useThemeColors();
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    const percentage = calculateGoalPercentage(goal);
    const progressColor = getProgressColor(percentage);
    const remaining = getRemainingAmount(goal);
    const payoff = projectGoalPayoff(goal);

    // Animation for progress bar
    const progressAnim = useSharedValue(0);
    React.useEffect(() => {
        progressAnim.value = withSpring(percentage / 100, {
            damping: 12,
            stiffness: 90,
        });
    }, [percentage]);

    const progressStyle = useAnimatedStyle(() => {
        return {
            width: `${interpolate(progressAnim.value, [0, 1], [0, 100])}%`,
        };
    });

    // Pulse animation for near completion
    const pulseAnim = useSharedValue(1);
    React.useEffect(() => {
        if (percentage >= 75 && percentage < 100 && !goal.isCompleted) {
            pulseAnim.value = withRepeat(
                withTiming(1.05, { duration: 1000 }),
                -1,
                true
            );
        } else {
            pulseAnim.value = withTiming(1);
        }
    }, [percentage, goal.isCompleted]);

    const pulseStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: pulseAnim.value }],
        };
    });

    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
        >
            <Animated.View style={[styles.container, pulseStyle]}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <View
                            style={[
                                styles.iconCircle,
                                { backgroundColor: goal.color + '20' },
                            ]}
                        >
                            <Text style={styles.iconText}>{goal.icon}</Text>
                        </View>
                    </View>

                    {goal.isCompleted && (
                        <View style={styles.completedBadge}>
                            <MaterialCommunityIcons
                                name="check-circle"
                                size={16}
                                color={themeColors.success}
                            />
                            <Text style={[styles.completedText, { color: themeColors.success }]}>
                                Completed
                            </Text>
                        </View>
                    )}
                </View>

                {/* Goal Name */}
                <Text style={styles.goalName} numberOfLines={2}>
                    {goal.name}
                </Text>

                {/* Progress Bar */}
                {goal.targetAmount && (
                    <>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBarBackground, { backgroundColor: themeColors.border }]}>
                                <Animated.View
                                    style={[
                                        styles.progressBarFill,
                                        { backgroundColor: goal.isCompleted ? themeColors.success : progressColor },
                                        progressStyle,
                                    ]}
                                />
                            </View>
                            <Text style={styles.percentageText}>{percentage.toFixed(0)}%</Text>
                        </View>

                        {/* Amount Info */}
                        <View style={styles.amountContainer}>
                            <View>
                                <Text style={styles.currentAmount}>
                                    ${goal.currentAmount.toFixed(0)}
                                </Text>
                                <Text style={styles.label}>Current</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={{ alignItems: 'flex-end' }}>
                                {goal.isCompleted ? (
                                    <>
                                        <Text style={[styles.targetAmount, { color: themeColors.success }]}>
                                            🎉 Reached!
                                        </Text>
                                        <Text style={styles.label}>You can buy it!</Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.targetAmount}>
                                            ${remaining.toFixed(0)}
                                        </Text>
                                        <Text style={styles.label}>To Go</Text>
                                    </>
                                )}
                            </View>
                        </View>

                        {!goal.isCompleted && payoff.monthsRemaining !== null && payoff.monthsRemaining > 0 && (
                            <View style={styles.payoffRow}>
                                <MaterialCommunityIcons
                                    name="calendar-check"
                                    size={14}
                                    color={themeColors.textSecondary}
                                />
                                <Text style={styles.payoffText}>
                                    On pace in {payoff.monthsRemaining === 1 ? '1 month' : `${payoff.monthsRemaining} months`}
                                </Text>
                            </View>
                        )}
                    </>
                )}

                {/* No target amount - simple display */}
                {!goal.targetAmount && (
                    <View style={styles.noTargetContainer}>
                        <MaterialCommunityIcons
                            name="information-outline"
                            size={16}
                            color={themeColors.textSecondary}
                        />
                        <Text style={styles.noTargetText}>No specific target</Text>
                    </View>
                )}
            </Animated.View>
        </TouchableOpacity>
    );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
    StyleSheet.create({
        container: {
            backgroundColor: themeColors.surface,
            borderRadius: 16,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: themeColors.border,
            marginBottom: spacing.md,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: spacing.md,
        },
        iconContainer: {
            flex: 1,
        },
        iconCircle: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconText: {
            fontSize: 24,
        },
        completedBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: themeColors.success + '10',
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: 12,
        },
        completedText: {
            ...typography.caption,
            fontWeight: '600',
        },
        goalName: {
            ...typography.h3,
            fontWeight: '700',
            color: themeColors.text,
            marginBottom: spacing.md,
        },
        progressBarContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        progressBarBackground: {
            flex: 1,
            height: 8,
            borderRadius: 4,
            overflow: 'hidden',
        },
        progressBarFill: {
            height: '100%',
            borderRadius: 4,
        },
        percentageText: {
            ...typography.caption,
            fontWeight: '700',
            color: themeColors.text,
            minWidth: 40,
            textAlign: 'right',
        },
        amountContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        currentAmount: {
            ...typography.h3,
            fontWeight: '700',
            color: themeColors.text,
        },
        targetAmount: {
            ...typography.h3,
            fontWeight: '700',
            color: themeColors.primary,
        },
        label: {
            ...typography.caption,
            color: themeColors.textSecondary,
            marginTop: spacing.xs,
        },
        divider: {
            width: 1,
            height: 30,
            backgroundColor: themeColors.border,
        },
        noTargetContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            padding: spacing.sm,
            backgroundColor: themeColors.background,
            borderRadius: 8,
        },
        noTargetText: {
            ...typography.caption,
            color: themeColors.textSecondary,
        },
        payoffRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: spacing.sm,
        },
        payoffText: {
            ...typography.caption,
            color: themeColors.textSecondary,
        },
    });
