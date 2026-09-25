// DebtCard - Beautiful card component for displaying debt information
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, isBefore } from 'date-fns';
import type { Debt } from '../../types/models';
import { DebtStatusBadge } from './DebtStatusBadge';
import { useThemeColors } from '../../hooks/useThemeColors';

interface DebtCardProps {
    debt: Debt;
    onPress: () => void;
}

export const DebtCard: React.FC<DebtCardProps> = ({ debt, onPress }) => {
    const themeColors = useThemeColors();
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const isOverdue = isBefore(debt.dueDate, Date.now()) && debt.status !== 'paid';
    const remainingAmount = debt.amount - debt.amountPaid;
    const progressPercent = (debt.amountPaid / debt.amount) * 100;

    // Generate avatar color from name
    const getAvatarColor = (name: string) => {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF',
            '#FF8B94', '#B4A7D6', '#89CFF0', '#06D6A0',
        ];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    const getInitials = (name: string) => {
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
        }).start();
    };

    const avatarColor = getAvatarColor(debt.personName);

    return (
        <TouchableOpacity
            activeOpacity={1}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}>
            <Animated.View
                style={[
                    styles.card,
                    { backgroundColor: themeColors.surface, transform: [{ scale: scaleAnim }] },
                ]}>
                {/* Header with Avatar and Info */}
                <View style={styles.header}>
                    <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                        <Text style={styles.avatarText}>{getInitials(debt.personName)}</Text>
                    </View>

                    <View style={styles.headerInfo}>
                        <Text style={[styles.personName, { color: themeColors.text }]} numberOfLines={1}>
                            {debt.personName}
                        </Text>
                        <View style={styles.dueDateRow}>
                            <Icon
                                name="calendar-clock"
                                size={14}
                                color={isOverdue ? '#EF476F' : themeColors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.dueDate,
                                    {
                                        color: isOverdue ? '#EF476F' : themeColors.textSecondary,
                                        marginLeft: 4,
                                    },
                                ]}>
                                {format(debt.dueDate, 'MMM dd, yyyy')}
                            </Text>
                        </View>
                    </View>

                    <DebtStatusBadge status={debt.status} isOverdue={isOverdue} size="small" />
                </View>

                {/* Amount Section */}
                <View style={styles.amountSection}>
                    <View>
                        <Text style={[styles.label, { color: themeColors.textSecondary }]}>
                            {debt.type === 'lent' ? 'They owe you' : 'You owe them'}
                        </Text>
                        <Text style={[styles.amount, { color: themeColors.text }]}>
                            ${remainingAmount.toFixed(3)}
                        </Text>
                    </View>

                    {debt.status === 'partial' && (
                        <View style={styles.partialInfo}>
                            <Text style={[styles.partialLabel, { color: themeColors.textSecondary }]}>
                                Paid: ${debt.amountPaid.toFixed(3)}
                            </Text>
                            <Text style={[styles.partialLabel, { color: themeColors.textSecondary }]}>
                                of ${debt.amount.toFixed(3)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Progress Bar (for partial payments) */}
                {debt.status === 'partial' && (
                    <View style={styles.progressSection}>
                        <View style={[styles.progressBar, { backgroundColor: themeColors.border }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${progressPercent}%`,
                                        backgroundColor: '#118AB2',
                                    },
                                ]}
                            />
                        </View>
                        <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>
                            {progressPercent.toFixed(0)}%
                        </Text>
                    </View>
                )}

                {/* Description (if exists) */}
                {debt.description && (
                    <Text
                        style={[styles.description, { color: themeColors.textSecondary }]}
                        numberOfLines={1}>
                        {debt.description}
                    </Text>
                )}
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    headerInfo: {
        flex: 1,
        marginRight: 8,
    },
    personName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    dueDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dueDate: {
        fontSize: 12,
    },
    amountSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    label: {
        fontSize: 12,
        marginBottom: 4,
    },
    amount: {
        fontSize: 24,
        fontWeight: '700',
    },
    partialInfo: {
        alignItems: 'flex-end',
    },
    partialLabel: {
        fontSize: 11,
    },
    progressSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    progressBar: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        marginRight: 8,
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 11,
        fontWeight: '600',
    },
    description: {
        fontSize: 12,
        marginTop: 8,
        fontStyle: 'italic',
    },
});
