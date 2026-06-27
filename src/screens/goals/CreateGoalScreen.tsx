import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
    Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Input } from '../../components/forms/Input';
import { AmountInput } from '../../components/forms/AmountInput';
import { Button } from '../../components/forms/Button';
import { useAuthStore } from '../../store/authStore';
import { GoalRepository } from '../../database/repositories/GoalRepository';
import { validateGoalInput, getFundingSourceIcon } from '../../utils/goalUtils';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { GoalFundingSource } from '../../types/models';
import { useThemeColors } from '../../hooks/useThemeColors';

type CreateGoalNavigationProp = StackNavigationProp<MainStackParamList, 'CreateGoal'>;
type CreateGoalRouteProp = RouteProp<MainStackParamList, 'CreateGoal' | 'EditGoal'>;

// Goal icons (emojis for simplicity)
const GOAL_ICONS = [
    '🎯', '💰', '🏠', '🚗', '✈️', '🎓', '💍', '🎮',
    '📱', '💻', '⌚', '🚲', '🏖️', '🎸', '📷', '🎨',
    '👕', '👟', '🎁', '🏆', '💎', '🌟', '🔑', '🛍️',
];

// Goal colors
const GOAL_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#f43f5e', '#a855f7', '#22c55e', '#eab308',
];

export default function CreateGoalScreen() {
    const navigation = useNavigation<CreateGoalNavigationProp>();
    const route = useRoute<CreateGoalRouteProp>();
    const { currentAccountId } = useAuthStore();
    const themeColors = useThemeColors();

    const isEditMode = route.params && 'goalId' in route.params;
    const goalId = route.params && 'goalId' in route.params ? route.params.goalId : undefined;

    const [name, setName] = useState('');
    const [hasTargetAmount, setHasTargetAmount] = useState(true);
    const [targetAmount, setTargetAmount] = useState('');
    const [fundingSource, setFundingSource] = useState<GoalFundingSource>('both');
    const [selectedIcon, setSelectedIcon] = useState(GOAL_ICONS[0]);
    const [selectedColor, setSelectedColor] = useState(GOAL_COLORS[0]);
    const [loading, setLoading] = useState(false);

    const goalRepo = new GoalRepository();
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    useEffect(() => {
        if (isEditMode && goalId) {
            loadGoal();
        }
    }, []);

    const loadGoal = async () => {
        if (!goalId) return;

        try {
            const goal = await goalRepo.findById(goalId);
            if (goal) {
                setName(goal.name);
                setHasTargetAmount(goal.targetAmount !== null);
                setTargetAmount(goal.targetAmount?.toString() || '');
                setFundingSource(goal.fundingSource);
                setSelectedIcon(goal.icon);
                setSelectedColor(goal.color);
            } else {
                Alert.alert('Error', 'Goal not found');
                navigation.goBack();
            }
        } catch (error) {
            console.error('[CreateGoal] Failed to load goal:', error);
            Alert.alert('Error', 'Failed to load goal');
            navigation.goBack();
        }
    };

    const handleSave = async () => {
        if (!currentAccountId) {
            Alert.alert('Error', 'No account selected');
            return;
        }

        const targetAmountValue = hasTargetAmount ? parseFloat(targetAmount) || null : null;

        const validation = validateGoalInput(name, targetAmountValue, fundingSource);
        if (!validation.valid) {
            Alert.alert('Validation Error', validation.error);
            return;
        }

        setLoading(true);

        try {
            if (isEditMode && goalId) {
                await goalRepo.update(goalId, {
                    name: name.trim(),
                    targetAmount: targetAmountValue,
                    fundingSource,
                    icon: selectedIcon,
                    color: selectedColor,
                });

                Alert.alert('Success', 'Goal updated successfully', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } else {
                await goalRepo.create({
                    accountId: currentAccountId,
                    name: name.trim(),
                    targetAmount: targetAmountValue,
                    fundingSource,
                    icon: selectedIcon,
                    color: selectedColor,
                });

                Alert.alert('Success', 'Goal created successfully', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            }
        } catch (error) {
            console.error('[CreateGoal] Failed to save goal:', error);
            Alert.alert('Error', 'Failed to save goal');
        } finally {
            setLoading(false);
        }
    };

    const fundingSources: Array<{ key: GoalFundingSource; label: string; icon: string }> = [
        { key: 'main', label: 'Main Balance', icon: 'wallet' },
        { key: 'savings', label: 'Savings', icon: 'piggy-bank' },
        { key: 'both', label: 'Main & Savings', icon: 'wallet-plus' },
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Goal Name */}
            <Input
                label="Goal Name"
                placeholder="e.g., Buy a car, Vacation to Hawaii"
                value={name}
                onChangeText={setName}
                leftIcon="target"
                autoFocus={!isEditMode}
            />

            {/* Target Amount Toggle */}
            <View style={styles.section}>
                <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>Set Target Amount</Text>
                        <Text style={styles.sectionSubtitle}>
                            {hasTargetAmount ? 'Goal has a specific price' : 'Just tracking by name'}
                        </Text>
                    </View>
                    <Switch
                        value={hasTargetAmount}
                        onValueChange={setHasTargetAmount}
                        trackColor={{ false: themeColors.border, true: themeColors.primary + '60' }}
                        thumbColor={hasTargetAmount ? themeColors.primary : themeColors.textSecondary}
                    />
                </View>
            </View>

            {/* Amount Input (conditional) */}
            {hasTargetAmount && (
                <AmountInput
                    label="Target Amount"
                    value={targetAmount}
                    onChangeText={setTargetAmount}
                    placeholder="0.00"
                />
            )}

            {/* Funding Source */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Funding Source</Text>
                <Text style={styles.sectionSubtitle}>
                    Choose which vault(s) to track for this goal
                </Text>
                <View style={styles.fundingGrid}>
                    {fundingSources.map((source) => (
                        <TouchableOpacity
                            key={source.key}
                            style={[
                                styles.fundingOption,
                                fundingSource === source.key && styles.fundingOptionSelected,
                                { borderColor: fundingSource === source.key ? themeColors.primary : themeColors.border },
                            ]}
                            onPress={() => setFundingSource(source.key)}
                        >
                            <MaterialCommunityIcons
                                name={source.icon as any}
                                size={28}
                                color={fundingSource === source.key ? themeColors.primary : themeColors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.fundingLabel,
                                    fundingSource === source.key && { color: themeColors.primary },
                                ]}
                            >
                                {source.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Icon Picker */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose Icon</Text>
                <View style={styles.iconGrid}>
                    {GOAL_ICONS.map((icon) => (
                        <TouchableOpacity
                            key={icon}
                            style={[
                                styles.iconOption,
                                selectedIcon === icon && styles.iconOptionSelected,
                                { borderColor: selectedIcon === icon ? selectedColor : themeColors.border },
                            ]}
                            onPress={() => setSelectedIcon(icon)}
                        >
                            <Text style={styles.iconText}>{icon}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Color Picker */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose Color</Text>
                <View style={styles.colorGrid}>
                    {GOAL_COLORS.map((color) => (
                        <TouchableOpacity
                            key={color}
                            style={[
                                styles.colorOption,
                                { backgroundColor: color },
                                selectedColor === color && styles.colorOptionSelected,
                            ]}
                            onPress={() => setSelectedColor(color)}
                        >
                            {selectedColor === color && (
                                <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Preview */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preview</Text>
                <View style={styles.preview}>
                    <View style={[styles.previewIcon, { backgroundColor: selectedColor + '20' }]}>
                        <Text style={styles.previewIconText}>{selectedIcon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.previewName}>{name || 'Goal Name'}</Text>
                        {hasTargetAmount && targetAmount && (
                            <Text style={styles.previewAmount}>Target: ${parseFloat(targetAmount).toFixed(2)}</Text>
                        )}
                        <Text style={styles.previewSource}>
                            From {fundingSources.find((s) => s.key === fundingSource)?.label || 'Unknown'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Save Button */}
            <View style={styles.footer}>
                <Button
                    title={isEditMode ? 'Update Goal' : 'Create Goal'}
                    onPress={handleSave}
                    loading={loading}
                    leftIcon={<MaterialCommunityIcons name={isEditMode ? 'check' : 'plus'} size={20} color="#FFF" />}
                />
            </View>
        </ScrollView>
    );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: themeColors.background,
        },
        content: {
            padding: spacing.md,
            paddingBottom: spacing.xxxl,
        },
        section: {
            marginBottom: spacing.xl,
        },
        toggleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        sectionTitle: {
            ...typography.h3,
            marginBottom: spacing.xs,
            color: themeColors.text,
        },
        sectionSubtitle: {
            ...typography.caption,
            color: themeColors.textSecondary,
        },
        fundingGrid: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.md,
        },
        fundingOption: {
            flex: 1,
            alignItems: 'center',
            padding: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 2,
            backgroundColor: themeColors.surface,
            gap: spacing.xs,
        },
        fundingOptionSelected: {
            backgroundColor: themeColors.background,
        },
        fundingLabel: {
            ...typography.caption,
            fontWeight: '600',
            color: themeColors.textSecondary,
            textAlign: 'center',
        },
        iconGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginTop: spacing.md,
        },
        iconOption: {
            width: 56,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: borderRadius.md,
            borderWidth: 2,
            backgroundColor: themeColors.surface,
        },
        iconOptionSelected: {
            borderWidth: 3,
            backgroundColor: themeColors.background,
        },
        iconText: {
            fontSize: 28,
        },
        colorGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginTop: spacing.md,
        },
        colorOption: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: 'transparent',
        },
        colorOptionSelected: {
            borderColor: themeColors.text,
        },
        preview: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.lg,
            backgroundColor: themeColors.surface,
            borderRadius: borderRadius.lg,
            gap: spacing.md,
            marginTop: spacing.md,
        },
        previewIcon: {
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
        },
        previewIconText: {
            fontSize: 28,
        },
        previewName: {
            ...typography.h3,
            color: themeColors.text,
            marginBottom: spacing.xs,
        },
        previewAmount: {
            ...typography.body,
            fontWeight: '600',
            color: themeColors.primary,
        },
        previewSource: {
            ...typography.caption,
            color: themeColors.textSecondary,
        },
        footer: {
            marginTop: spacing.lg,
        },
    });
