// DebtDetailsScreen - View and manage a specific debt
import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { format, isBefore } from 'date-fns';
import { DebtRepository } from '../../database/repositories/DebtRepository';
import type { Debt } from '../../types/models';
import { DebtStatusBadge } from '../../components/debts/DebtStatusBadge';
import { AmountInput } from '../../components/forms/AmountInput';
import { Button } from '../../components/forms/Button';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

type DebtDetailsNavigationProp = StackNavigationProp<MainStackParamList, 'DebtDetails'>;
type DebtDetailsRouteProp = RouteProp<MainStackParamList, 'DebtDetails'>;

export default function DebtDetailsScreen() {
    const navigation = useNavigation<DebtDetailsNavigationProp>();
    const route = useRoute<DebtDetailsRouteProp>();
    const themeColors = useThemeColors();
    const { debtId } = route.params;

    const [debt, setDebt] = useState<Debt | null>(null);
    const [loading, setLoading] = useState(true);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [showPaymentInput, setShowPaymentInput] = useState(false);

    const debtRepo = new DebtRepository();
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    const loadDebt = async () => {
        try {
            const loadedDebt = await debtRepo.findById(debtId);
            if (loadedDebt) {
                setDebt(loadedDebt);
            } else {
                Alert.alert('Error', 'Debt not found');
                navigation.goBack();
            }
        } catch (error) {
            console.error('[DebtDetails] Failed to load debt:', error);
            Alert.alert('Error', 'Failed to load debt');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadDebt();
        }, [debtId])
    );

    const handleRecordPayment = async () => {
        if (!debt) return;

        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
            return;
        }

        const remainingAmount = debt.amount - debt.amountPaid;
        if (amount > remainingAmount) {
            Alert.alert(
                'Amount Too Large',
                `Payment amount ($${amount.toFixed(2)}) exceeds remaining debt ($${remainingAmount.toFixed(2)})`
            );
            return;
        }

        try {
            await debtRepo.recordPayment(debtId, amount);
            Alert.alert('Success', 'Payment recorded successfully');
            setPaymentAmount('');
            setShowPaymentInput(false);
            loadDebt();
        } catch (error) {
            console.error('[DebtDetails] Failed to record payment:', error);
            Alert.alert('Error', 'Failed to record payment');
        }
    };

    const handleMarkAsPaid = () => {
        if (!debt) return;

        const remainingAmount = debt.amount - debt.amountPaid;
        Alert.alert(
            'Mark as Paid',
            `Are you sure you want to mark this debt as fully paid?${remainingAmount > 0 ? `\n\nThis will record a final payment of $${remainingAmount.toFixed(2)}.` : ''}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark as Paid',
                    onPress: async () => {
                        try {
                            await debtRepo.markAsPaid(debtId);
                            Alert.alert('Success', 'Debt marked as paid');
                            loadDebt();
                        } catch (error) {
                            console.error('[DebtDetails] Failed to mark as paid:', error);
                            Alert.alert('Error', 'Failed to mark debt as paid');
                        }
                    },
                },
            ]
        );
    };

    const handleEdit = () => {
        navigation.navigate('EditDebt', { debtId });
    };

    const handleDelete = () => {
        if (!debt) return;

        Alert.alert(
            'Delete Debt',
            `Are you sure you want to delete this debt with ${debt.personName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await debtRepo.delete(debtId);
                            Alert.alert('Success', 'Debt deleted successfully');
                            navigation.goBack();
                        } catch (error) {
                            console.error('[DebtDetails] Failed to delete:', error);
                            Alert.alert('Error', 'Failed to delete debt');
                        }
                    },
                },
            ]
        );
    };

    if (loading || !debt) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={{ color: themeColors.textSecondary }}>Loading...</Text>
            </View>
        );
    }

    const isOverdue = isBefore(debt.dueDate, Date.now()) && debt.status !== 'paid';
    const remainingAmount = debt.amount - debt.amountPaid;
    const progressPercent = (debt.amountPaid / debt.amount) * 100;

    const gradientColors = debt.type === 'lent' ? ['#06D6A0', '#118AB2'] : ['#FF6B6B', '#EF476F'];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header Card */}
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerCard}>
                <View style={styles.headerTop}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerLabel}>
                            {debt.type === 'lent' ? 'They owe you' : 'You owe them'}
                        </Text>
                        <Text style={styles.headerAmount}>${remainingAmount.toFixed(2)}</Text>
                        <Text style={styles.headerPerson}>{debt.personName}</Text>
                    </View>
                    <DebtStatusBadge status={debt.status} isOverdue={isOverdue} size="large" />
                </View>

                {debt.status === 'partial' && (
                    <View style={styles.progressSection}>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                        </View>
                        <Text style={styles.progressText}>
                            {`${progressPercent.toFixed(0)}% paid • $${debt.amountPaid.toFixed(2)} of $${debt.amount.toFixed(2)}`}
                        </Text>
                    </View>
                )}
            </LinearGradient>

            {/* Due Date Card */}
            <View style={[styles.infoCard, { backgroundColor: themeColors.surface }]}>
                <MaterialCommunityIcons
                    name="calendar-clock"
                    size={24}
                    color={isOverdue ? '#EF476F' : themeColors.primary}
                />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Due Date</Text>
                    <Text style={[styles.infoValue, { color: isOverdue ? '#EF476F' : themeColors.text }]}>
                        {format(debt.dueDate, 'MMMM dd, yyyy')}
                    </Text>
                    {isOverdue && <Text style={styles.overdueLabel}>Overdue!</Text>}
                </View>
            </View>

            {/* Description */}
            {!!debt.description && (
                <View style={[styles.infoCard, { backgroundColor: themeColors.surface }]}>
                    <MaterialCommunityIcons name="text" size={24} color={themeColors.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>Notes</Text>
                        <Text style={[styles.infoValue, { color: themeColors.text }]}>{debt.description}</Text>
                    </View>
                </View>
            )}

            {/* Payment Input (for pending/partial debts) */}
            {debt.status !== 'paid' && (
                <>
                    {showPaymentInput ? (
                        <View style={[styles.paymentSection, { backgroundColor: themeColors.surface }]}>
                            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Record Payment</Text>
                            <AmountInput
                                label="Payment Amount"
                                value={paymentAmount}
                                onChangeText={setPaymentAmount}
                                placeholder="0.00"
                            />
                            <View style={styles.buttonRow}>
                                <Button
                                    title="Cancel"
                                    onPress={() => {
                                        setShowPaymentInput(false);
                                        setPaymentAmount('');
                                    }}
                                    variant="outline"
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    title="Record"
                                    onPress={handleRecordPayment}
                                    leftIcon="check"
                                    style={{ flex: 1 }}
                                />
                            </View>
                        </View>
                    ) : (
                        <View style={styles.actionButtons}>
                            <Button
                                title="Record Payment"
                                onPress={() => setShowPaymentInput(true)}
                                leftIcon="cash"
                                variant="outline"
                            />
                            <Button
                                title="Mark as Paid"
                                onPress={handleMarkAsPaid}
                                leftIcon="check-circle"
                            />
                        </View>
                    )}
                </>
            )}

            {/* Management Buttons */}
            <View style={styles.managementButtons}>
                <TouchableOpacity
                    style={[styles.managementButton, { backgroundColor: themeColors.surface }]}
                    onPress={handleEdit}>
                    <MaterialCommunityIcons name="pencil" size={20} color={themeColors.primary} />
                    <Text style={[styles.managementButtonText, { color: themeColors.text }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.managementButton, { backgroundColor: themeColors.surface }]}
                    onPress={handleDelete}>
                    <MaterialCommunityIcons name="delete" size={20} color="#EF476F" />
                    <Text style={[styles.managementButtonText, { color: '#EF476F' }]}>Delete</Text>
                </TouchableOpacity>
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
        centered: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        content: {
            padding: spacing.md,
            paddingBottom: spacing.xxxl,
        },
        headerCard: {
            borderRadius: borderRadius.xl,
            padding: spacing.lg,
            marginBottom: spacing.md,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
        },
        headerTop: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginBottom: spacing.md,
        },
        headerLabel: {
            fontSize: 14,
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: spacing.xs,
        },
        headerAmount: {
            fontSize: 36,
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: spacing.xs,
        },
        headerPerson: {
            fontSize: 18,
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.95)',
        },
        progressSection: {
            marginTop: spacing.md,
        },
        progressBar: {
            height: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: spacing.xs,
        },
        progressFill: {
            height: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: 4,
        },
        progressText: {
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.9)',
            fontWeight: '600',
        },
        infoCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            marginBottom: spacing.md,
            gap: spacing.md,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        infoLabel: {
            ...typography.caption,
            marginBottom: 4,
        },
        infoValue: {
            ...typography.body,
            fontWeight: '600',
        },
        overdueLabel: {
            color: '#EF476F',
            ...typography.caption,
            fontWeight: '600',
            marginTop: 4,
        },
        paymentSection: {
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            marginBottom: spacing.md,
        },
        sectionTitle: {
            ...typography.h3,
            marginBottom: spacing.md,
        },
        buttonRow: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.sm,
        },
        actionButtons: {
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        managementButtons: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.md,
        },
        managementButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.md,
            borderRadius: borderRadius.md,
            gap: spacing.xs,
        },
        managementButtonText: {
            ...typography.body,
            fontWeight: '600',
        },
    });
