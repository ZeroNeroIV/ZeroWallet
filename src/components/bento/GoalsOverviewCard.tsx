import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { BentoCard } from './BentoCard';
import { useThemeColors } from '../../hooks/useThemeColors';

interface GoalsOverviewCardProps {
    activeGoalsCount: number;
    completedGoalsCount: number;
    nearestGoalProgress: number;
    nearestGoalName: string;
    onPress: () => void;
    delay?: number;
}

export const GoalsOverviewCard: React.FC<GoalsOverviewCardProps> = ({
    activeGoalsCount,
    completedGoalsCount,
    nearestGoalProgress,
    nearestGoalName,
    onPress,
    delay = 0,
}) => {
    const themeColors = useThemeColors();
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
            <BentoCard delay={delay} style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.label}>Goals</Text>
                    <MaterialCommunityIcons
                        name="target"
                        size={24}
                        color={themeColors.primary}
                    />
                </View>

                {activeGoalsCount === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🎯</Text>
                        <Text style={styles.emptyText}>Set your first goal!</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{activeGoalsCount}</Text>
                                <Text style={styles.statLabel}>Active</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.statItem}>
                                <Text style={[styles.statNumber, { color: themeColors.success }]}>
                                    {completedGoalsCount}
                                </Text>
                                <Text style={styles.statLabel}>Completed</Text>
                            </View>
                        </View>

                        {nearestGoalName && (
                            <View style={styles.nearestGoal}>
                                <Text style={styles.nearestLabel}>Nearest to completion:</Text>
                                <View style={styles.nearestInfo}>
                                    <Text style={styles.nearestName} numberOfLines={1}>
                                        {nearestGoalName}
                                    </Text>
                                    <View style={styles.smallProgressBar}>
                                        <View
                                            style={[
                                                styles.smallProgressFill,
                                                {
                                                    width: `${Math.min(nearestGoalProgress, 100)}%`,
                                                    backgroundColor:
                                                        nearestGoalProgress >= 75
                                                            ? themeColors.success
                                                            : themeColors.primary,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.nearestPercentage}>
                                        {nearestGoalProgress.toFixed(0)}%
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
                )}
            </BentoCard>
        </TouchableOpacity>
    );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
    StyleSheet.create({
        container: {
            minHeight: 140,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
        },
        label: {
            ...typography.body,
            fontWeight: '600',
            color: themeColors.textSecondary,
        },
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.lg,
        },
        emptyIcon: {
            fontSize: 40,
            marginBottom: spacing.sm,
        },
        emptyText: {
            ...typography.body,
            color: themeColors.textSecondary,
        },
        statsContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            marginBottom: spacing.md,
        },
        statItem: {
            alignItems: 'center',
            flex: 1,
        },
        statNumber: {
            ...typography.h1,
            fontSize: 36,
            fontWeight: '700',
            color: themeColors.primary,
        },
        statLabel: {
            ...typography.caption,
            color: themeColors.textSecondary,
            marginTop: spacing.xs,
        },
        divider: {
            width: 1,
            height: 40,
            backgroundColor: themeColors.border,
        },
        nearestGoal: {
            backgroundColor: themeColors.background,
            padding: spacing.md,
            borderRadius: 12,
        },
        nearestLabel: {
            ...typography.caption,
            color: themeColors.textSecondary,
            marginBottom: spacing.xs,
        },
        nearestInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        nearestName: {
            ...typography.body,
            fontWeight: '600',
            color: themeColors.text,
            flex: 1,
        },
        smallProgressBar: {
            width: 60,
            height: 6,
            backgroundColor: themeColors.border,
            borderRadius: 3,
            overflow: 'hidden',
        },
        smallProgressFill: {
            height: '100%',
            borderRadius: 3,
        },
        nearestPercentage: {
            ...typography.caption,
            fontWeight: '700',
            color: themeColors.text,
            minWidth: 35,
            textAlign: 'right',
        },
    });
