// DebtSummaryCard - Dashboard card showing debt overview
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import type { DebtStats } from '../../types/models';
import { useThemeColors } from '../../hooks/useThemeColors';

interface DebtSummaryCardProps {
    stats: DebtStats;
    onPress: () => void;
}

export const DebtSummaryCard: React.FC<DebtSummaryCardProps> = ({ stats, onPress }) => {
    const themeColors = useThemeColors();

    const hasDebts =
        stats.totalLent > 0 ||
        stats.totalBorrowed > 0 ||
        stats.pendingLentCount > 0 ||
        stats.pendingBorrowedCount > 0;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}>
            <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Icon name="handshake" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.title}>Debts</Text>
                    {stats.overdueCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{stats.overdueCount}</Text>
                        </View>
                    )}
                </View>

                {hasDebts ? (
                    <>
                        {/* Lent Money */}
                        <View style={styles.row}>
                            <View style={styles.rowIcon}>
                                <Icon name="arrow-up-circle" size={16} color="#06D6A0" />
                            </View>
                            <Text style={styles.rowLabel}>Owed to me</Text>
                            <Text style={styles.rowAmount}>${stats.totalLent.toFixed(3)}</Text>
                        </View>

                        {/* Borrowed Money */}
                        <View style={styles.row}>
                            <View style={styles.rowIcon}>
                                <Icon name="arrow-down-circle" size={16} color="#FF6B6B" />
                            </View>
                            <Text style={styles.rowLabel}>I owe</Text>
                            <Text style={styles.rowAmount}>${stats.totalBorrowed.toFixed(3)}</Text>
                        </View>

                        {/* Footer with counts */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                {stats.pendingLentCount + stats.pendingBorrowedCount} active debt
                                {stats.pendingLentCount + stats.pendingBorrowedCount !== 1 ? 's' : ''}
                            </Text>
                            {stats.overdueCount > 0 && (
                                <Text style={styles.overdueText}>• {stats.overdueCount} overdue</Text>
                            )}
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No active debts</Text>
                        <Text style={styles.emptySubtext}>Tap to add one</Text>
                    </View>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 8,
    },
    gradient: {
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        flex: 1,
    },
    badge: {
        backgroundColor: '#EF476F',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        minWidth: 24,
        alignItems: 'center',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    rowIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    rowLabel: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        flex: 1,
    },
    rowAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
    },
    footerText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    overdueText: {
        fontSize: 12,
        color: '#FFCCCB',
        marginLeft: 8,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
    },
});
