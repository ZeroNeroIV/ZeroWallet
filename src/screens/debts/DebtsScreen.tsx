// DebtsScreen - Main screen for managing debts with tabs for lent/borrowed
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
import { DebtRepository } from '../../database/repositories/DebtRepository';
import type { Debt, DebtStats } from '../../types/models';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Button } from '../../components/forms/Button';
import { useThemeColors } from '../../hooks/useThemeColors';
import { DebtCard } from '../../components/debts/DebtCard';

type DebtsNavigationProp = StackNavigationProp<MainStackParamList, 'DebtsScreen'>;

export default function DebtsScreen() {
    const navigation = useNavigation<DebtsNavigationProp>();
    const { currentAccountId } = useAuthStore();
    const themeColors = useThemeColors();

    const [activeTab, setActiveTab] = useState<'lent' | 'borrowed'>('lent');
    const [debts, setDebts] = useState<Debt[]>([]);
    const [stats, setStats] = useState<DebtStats>({
        totalLent: 0,
        totalBorrowed: 0,
        totalLentPaid: 0,
        totalBorrowedPaid: 0,
        overdueCount: 0,
        pendingLentCount: 0,
        pendingBorrowedCount: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const debtRepo = new DebtRepository();
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    const loadDebts = async () => {
        if (!currentAccountId) return;

        try {
            const allDebts = await debtRepo.findByAccount(currentAccountId);
            const debtStats = await debtRepo.getDebtStats(currentAccountId);

            setDebts(allDebts);
            setStats(debtStats);
        } catch (error) {
            console.error('[DebtsScreen] Failed to load debts:', error);
            Alert.alert('Error', 'Failed to load debts');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadDebts();
        }, [currentAccountId])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadDebts();
    };

    const handleAddDebt = () => {
        navigation.navigate('AddDebt', { type: activeTab });
    };

    const handleDebtPress = (debt: Debt) => {
        navigation.navigate('DebtDetails', { debtId: debt.id });
    };

    const handleDebtLongPress = (debt: Debt) => {
        Alert.alert(
            debt.personName,
            'What would you like to do?',
            [
                {
                    text: 'View Details',
                    onPress: () => handleDebtPress(debt),
                },
                {
                    text: 'Edit',
                    onPress: () => navigation.navigate('EditDebt', { debtId: debt.id }),
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDeleteDebt(debt),
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    };

    const handleDeleteDebt = (debt: Debt) => {
        Alert.alert(
            'Delete Debt',
            `Are you sure you want to delete this debt with ${debt.personName}? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await debtRepo.delete(debt.id);
                            Alert.alert('Success', 'Debt deleted successfully');
                            loadDebts();
                        } catch (error) {
                            console.error('[DebtsScreen] Failed to delete debt:', error);
                            Alert.alert('Error', 'Failed to delete debt');
                        }
                    },
                },
            ]
        );
    };

    const filteredDebts = debts.filter((debt) => debt.type === activeTab);
    const activeDebts = filteredDebts.filter((d) => d.status !== 'paid');

    const currentTabStats = activeTab === 'lent' ? stats.totalLent : stats.totalBorrowed;
    const currentTabCount = activeTab === 'lent' ? stats.pendingLentCount : stats.pendingBorrowedCount;

    const renderDebtItem = ({ item }: { item: Debt }) => (
        <DebtCard
            debt={item}
            onPress={() => handleDebtPress(item)}
        />
    );

    return (
        <View style={styles.container}>
            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'lent' && styles.tabActive]}
                    onPress={() => setActiveTab('lent')}>
                    <MaterialCommunityIcons
                        name="arrow-up-circle"
                        size={20}
                        color={activeTab === 'lent' ? '#FFFFFF' : themeColors.textSecondary}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'lent' && styles.tabTextActive,
                        ]}>
                        Owed to Me
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'borrowed' && styles.tabActive]}
                    onPress={() => setActiveTab('borrowed')}>
                    <MaterialCommunityIcons
                        name="arrow-down-circle"
                        size={20}
                        color={activeTab === 'borrowed' ? '#FFFFFF' : themeColors.textSecondary}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'borrowed' && styles.tabTextActive,
                        ]}>
                        I Owe
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Summary Card */}
            {activeDebts.length > 0 && (
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                            Total {activeTab === 'lent' ? 'owed to you' : 'you owe'}
                        </Text>
                        <Text style={[styles.summaryAmount, { color: themeColors.text }]}>
                            ${currentTabStats.toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summarySubtext, { color: themeColors.textSecondary }]}>
                            {currentTabCount} active debt{currentTabCount !== 1 ? 's' : ''}
                        </Text>
                        {stats.overdueCount > 0 && (
                            <Text style={styles.overdueText}>
                                {stats.overdueCount} overdue
                            </Text>
                        )}
                    </View>
                </View>
            )}

            {/* Debts List */}
            <FlatList
                data={filteredDebts}
                keyExtractor={(item) => item.id}
                renderItem={renderDebtItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>
                            {activeTab === 'lent' ? '💸' : '💰'}
                        </Text>
                        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
                            {activeTab === 'lent' ? 'No Money Lent' : 'No Money Borrowed'}
                        </Text>
                        <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                            {activeTab === 'lent'
                                ? 'Track money you lent to others'
                                : 'Track money you borrowed'}
                        </Text>
                    </View>
                }
            />

            {/* Add Debt Button */}
            <View style={[styles.footer, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
                <Button
                    title={activeTab === 'lent' ? 'I Lent Money' : 'I Borrowed Money'}
                    onPress={handleAddDebt}
                    leftIcon={<MaterialCommunityIcons name="plus" size={20} color="#FFF" />}
                />
            </View>
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
        summaryCard: {
            backgroundColor: themeColors.surface,
            marginHorizontal: spacing.md,
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        summaryRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.xs,
        },
        summaryLabel: {
            ...typography.body,
            fontSize: 14,
        },
        summaryAmount: {
            ...typography.h2,
            fontWeight: '700',
        },
        summarySubtext: {
            ...typography.caption,
        },
        overdueText: {
            ...typography.caption,
            color: '#EF476F',
            fontWeight: '600',
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
            marginBottom: spacing.xs,
        },
        emptySubtitle: {
            ...typography.body,
            textAlign: 'center',
        },
        footer: {
            padding: spacing.md,
            borderTopWidth: 1,
        },
    });
