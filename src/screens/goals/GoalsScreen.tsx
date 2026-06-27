import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { GoalRepository } from '../../database/repositories/GoalRepository';
import type { Goal } from '../../types/models';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Button } from '../../components/forms/Button';
import { useThemeColors } from '../../hooks/useThemeColors';
import { GoalCard } from '../../components/goals/GoalCard';
import { GoalCompletionModal } from '../../components/goals/GoalCompletionModal';
import { calculateGoalProgress, isGoalReached } from '../../utils/goalUtils';

type GoalsNavigationProp = StackNavigationProp<MainStackParamList, 'GoalsScreen'>;

export default function GoalsScreen() {
    const navigation = useNavigation<GoalsNavigationProp>();
    const { currentAccountId } = useAuthStore();
    const { balances } = useAccountStore();
    const themeColors = useThemeColors();

    const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [completionModalVisible, setCompletionModalVisible] = useState(false);
    const [selectedGoalForCompletion, setSelectedGoalForCompletion] = useState<Goal | null>(null);

    const goalRepo = new GoalRepository();
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    const loadGoals = async () => {
        if (!currentAccountId) return;

        try {
            const allGoals = await goalRepo.findByAccount(currentAccountId);

            // Update progress for all goals based on current vault balances
            const balance = balances[currentAccountId] || {
                mainBalance: 0,
                savingsBalance: 0,
                heldBalance: 0,
                totalBalance: 0,
                availableBalance: 0,
                accountId: currentAccountId,
                lastUpdated: Date.now(),
            };

            // Update each goal's progress
            for (const goal of allGoals) {
                const newProgress = calculateGoalProgress(goal, balance);
                if (newProgress !== goal.currentAmount) {
                    await goalRepo.updateProgress(goal.id, newProgress);
                    goal.currentAmount = newProgress;
                }

                // Check if goal was just reached
                if (!goal.isCompleted && isGoalReached(goal)) {
                    setSelectedGoalForCompletion(goal);
                    setCompletionModalVisible(true);
                }
            }

            setGoals(allGoals);
        } catch (error) {
            console.error('[GoalsScreen] Failed to load goals:', error);
            Alert.alert('Error', 'Failed to load goals');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadGoals();
        }, [currentAccountId])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadGoals();
    };

    const handleCreateGoal = () => {
        navigation.navigate('CreateGoal', {});
    };

    const handleGoalPress = (goal: Goal) => {
        navigation.navigate('GoalDetails', { goalId: goal.id });
    };

    const handleGoalLongPress = (goal: Goal) => {
        Alert.alert(
            goal.name,
            'What would you like to do?',
            [
                {
                    text: 'View Details',
                    onPress: () => handleGoalPress(goal),
                },
                {
                    text: 'Edit',
                    onPress: () => navigation.navigate('EditGoal', { goalId: goal.id }),
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDeleteGoal(goal),
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    };

    const handleDeleteGoal = (goal: Goal) => {
        Alert.alert(
            'Delete Goal',
            `Are you sure you want to delete "${goal.name}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await goalRepo.delete(goal.id);
                            Alert.alert('Success', 'Goal deleted successfully');
                            loadGoals();
                        } catch (error) {
                            console.error('[GoalsScreen] Failed to delete goal:', error);
                            Alert.alert('Error', 'Failed to delete goal');
                        }
                    },
                },
            ]
        );
    };

    const handleMarkComplete = async () => {
        if (!selectedGoalForCompletion) return;

        try {
            await goalRepo.markCompleted(selectedGoalForCompletion.id);
            setCompletionModalVisible(false);
            setSelectedGoalForCompletion(null);
            loadGoals();
        } catch (error) {
            console.error('[GoalsScreen] Failed to mark goal as complete:', error);
            Alert.alert('Error', 'Failed to mark goal as complete');
        }
    };

    const handleCreateNewAfterCompletion = () => {
        setCompletionModalVisible(false);
        setSelectedGoalForCompletion(null);
        handleCreateGoal();
    };

    const filteredGoals = goals.filter((goal) =>
        activeTab === 'active' ? !goal.isCompleted : goal.isCompleted
    );

    const renderGoalItem = ({ item }: { item: Goal }) => (
        <GoalCard
            goal={item}
            onPress={() => handleGoalLongPress(item)}
        />
    );

    return (
        <View style={styles.container}>
            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'active' && styles.tabActive]}
                    onPress={() => setActiveTab('active')}
                >
                    <MaterialCommunityIcons
                        name="target"
                        size={20}
                        color={activeTab === 'active' ? '#FFFFFF' : themeColors.textSecondary}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'active' && styles.tabTextActive,
                        ]}
                    >
                        Active
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
                    onPress={() => setActiveTab('completed')}
                >
                    <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={activeTab === 'completed' ? '#FFFFFF' : themeColors.textSecondary}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'completed' && styles.tabTextActive,
                        ]}
                    >
                        Completed
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Goals List */}
            <FlatList
                data={filteredGoals}
                keyExtractor={(item) => item.id}
                renderItem={renderGoalItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>
                            {activeTab === 'active' ? '🎯' : '🏆'}
                        </Text>
                        <Text style={styles.emptyTitle}>
                            {activeTab === 'active' ? 'No Active Goals' : 'No Completed Goals'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {activeTab === 'active'
                                ? 'Create your first savings goal!'
                                : 'Complete goals will appear here'}
                        </Text>
                    </View>
                }
            />

            {/* Add Goal Button */}
            <View style={styles.footer}>
                <Button
                    title="Create New Goal"
                    onPress={handleCreateGoal}
                    leftIcon={<MaterialCommunityIcons name="plus" size={20} color="#FFF" />}
                />
            </View>

            {/* Completion Modal */}
            <GoalCompletionModal
                goal={selectedGoalForCompletion}
                visible={completionModalVisible}
                onMarkComplete={handleMarkComplete}
                onCreateNew={handleCreateNewAfterCompletion}
                onClose={() => {
                    setCompletionModalVisible(false);
                    setSelectedGoalForCompletion(null);
                }}
            />
        </View>
    );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: themeColors.background,
        },
        tabContainer: {
            flexDirection: 'row',
            padding: spacing.md,
            gap: spacing.sm,
            backgroundColor: themeColors.surface,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border,
        },
        tab: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: themeColors.background,
            gap: spacing.xs,
        },
        tabActive: {
            backgroundColor: themeColors.primary,
        },
        tabText: {
            ...typography.body,
            fontWeight: '600',
            color: themeColors.textSecondary,
        },
        tabTextActive: {
            color: '#FFFFFF',
        },
        listContent: {
            padding: spacing.md,
            flexGrow: 1,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: spacing.xxxl,
        },
        emptyIcon: {
            fontSize: 64,
            marginBottom: spacing.md,
        },
        emptyTitle: {
            ...typography.h3,
            color: themeColors.text,
            marginBottom: spacing.xs,
        },
        emptySubtitle: {
            ...typography.body,
            color: themeColors.textSecondary,
        },
        footer: {
            padding: spacing.md,
            backgroundColor: themeColors.surface,
            borderTopWidth: 1,
            borderTopColor: themeColors.border,
        },
    });
