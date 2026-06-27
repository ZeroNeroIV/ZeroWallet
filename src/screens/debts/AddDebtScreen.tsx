// AddDebtScreen - Create or edit a debt
import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Input } from '../../components/forms/Input';
import { AmountInput } from '../../components/forms/AmountInput';
import { Button } from '../../components/forms/Button';
import { useAuthStore } from '../../store/authStore';
import { DebtRepository } from '../../database/repositories/DebtRepository';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { DebtType } from '../../types/models';
import { useThemeColors } from '../../hooks/useThemeColors';
import { format } from 'date-fns';

type AddDebtNavigationProp = StackNavigationProp<MainStackParamList, 'AddDebt'>;
type AddDebtRouteProp = RouteProp<MainStackParamList, 'AddDebt' | 'EditDebt'>;

export default function AddDebtScreen() {
    const navigation = useNavigation<AddDebtNavigationProp>();
    const route = useRoute<AddDebtRouteProp>();
    const { currentAccountId } = useAuthStore();
    const themeColors = useThemeColors();

    const isEditMode = route.params && 'debtId' in route.params;
    const debtId = route.params && 'debtId' in route.params ? route.params.debtId : undefined;
    const initialType = route.params && 'type' in route.params ? route.params.type : 'lent';

    const [debtType, setDebtType] = useState<DebtType>(initialType || 'lent');
    const [personName, setPersonName] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const debtRepo = new DebtRepository();
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    useEffect(() => {
        if (isEditMode && debtId) {
            loadDebt();
        }
    }, []);

    const loadDebt = async () => {
        if (!debtId) return;

        try {
            const debt = await debtRepo.findById(debtId);
            if (debt) {
                setDebtType(debt.type);
                setPersonName(debt.personName);
                setAmount(debt.amount.toString());
                setDueDate(new Date(debt.dueDate));
                setDescription(debt.description || '');
            } else {
                Alert.alert('Error', 'Debt not found');
                navigation.goBack();
            }
        } catch (error) {
            console.error('[AddDebt] Failed to load debt:', error);
            Alert.alert('Error', 'Failed to load debt');
            navigation.goBack();
        }
    };

    const handleSave = async () => {
        if (!currentAccountId) {
            Alert.alert('Error', 'No account selected');
            return;
        }

        if (!personName.trim()) {
            Alert.alert('Validation Error', 'Please enter the person\'s name');
            return;
        }

        const amountValue = parseFloat(amount);
        if (!amountValue || amountValue <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid amount');
            return;
        }

        if (dueDate < new Date()) {
            Alert.alert(
                'Past Due Date',
                'The due date is in the past. Do you want to continue?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Continue', onPress: () => saveDebt() },
                ]
            );
            return;
        }

        await saveDebt();
    };

    const saveDebt = async () => {
        if (!currentAccountId) return;

        setLoading(true);

        try {
            if (isEditMode && debtId) {
                await debtRepo.update(debtId, {
                    personName: personName.trim(),
                    amount: parseFloat(amount),
                    dueDate: dueDate.getTime(),
                    description: description.trim(),
                });

                Alert.alert('Success', 'Debt updated successfully', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } else {
                await debtRepo.create({
                    accountId: currentAccountId,
                    type: debtType,
                    personName: personName.trim(),
                    amount: parseFloat(amount),
                    dueDate: dueDate.getTime(),
                    description: description.trim(),
                });

                Alert.alert('Success', 'Debt created successfully', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            }
        } catch (error) {
            console.error('[AddDebt] Failed to save debt:', error);
            Alert.alert('Error', 'Failed to save debt');
        } finally {
            setLoading(false);
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setDueDate(selectedDate);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Debt Type Selector */}
            {!isEditMode && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Type</Text>
                    <View style={styles.typeGrid}>
                        <TouchableOpacity
                            style={[
                                styles.typeOption,
                                { borderColor: debtType === 'lent' ? themeColors.primary : themeColors.border },
                                debtType === 'lent' && { backgroundColor: themeColors.primary + '10' },
                            ]}
                            onPress={() => setDebtType('lent')}>
                            <MaterialCommunityIcons
                                name="arrow-up-circle"
                                size={32}
                                color={debtType === 'lent' ? themeColors.primary : themeColors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.typeLabel,
                                    { color: debtType === 'lent' ? themeColors.primary : themeColors.textSecondary },
                                ]}>
                                I Lent Money
                            </Text>
                            <Text style={[styles.typeSubtext, { color: themeColors.textSecondary }]}>
                                They owe you
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.typeOption,
                                { borderColor: debtType === 'borrowed' ? themeColors.primary : themeColors.border },
                                debtType === 'borrowed' && { backgroundColor: themeColors.primary + '10' },
                            ]}
                            onPress={() => setDebtType('borrowed')}>
                            <MaterialCommunityIcons
                                name="arrow-down-circle"
                                size={32}
                                color={debtType === 'borrowed' ? themeColors.primary : themeColors.textSecondary}
                            />
                            <Text
                                style={[
                                    styles.typeLabel,
                                    { color: debtType === 'borrowed' ? themeColors.primary : themeColors.textSecondary },
                                ]}>
                                I Borrowed Money
                            </Text>
                            <Text style={[styles.typeSubtext, { color: themeColors.textSecondary }]}>
                                You owe them
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Person Name */}
            <Input
                label="Person's Name"
                placeholder="e.g., John Smith"
                value={personName}
                onChangeText={setPersonName}
                leftIcon="account"
                autoFocus={!isEditMode}
            />

            {/* Amount */}
            <AmountInput
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
            />

            {/* Due Date */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Due Date</Text>
                <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                    onPress={() => setShowDatePicker(true)}>
                    <MaterialCommunityIcons
                        name="calendar-clock"
                        size={20}
                        color={themeColors.primary}
                    />
                    <Text style={[styles.dateText, { color: themeColors.text }]}>
                        {format(dueDate, 'MMMM dd, yyyy')}
                    </Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker
                        value={dueDate}
                        mode="date"
                        display="default"
                        onChange={onDateChange}
                        minimumDate={new Date()}
                    />
                )}
            </View>

            {/* Description (Optional) */}
            <Input
                label="Notes (Optional)"
                placeholder="e.g., For car repair"
                value={description}
                onChangeText={setDescription}
                leftIcon="text"
                multiline
                numberOfLines={3}
            />

            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: themeColors.surface }]}>
                <MaterialCommunityIcons
                    name={debtType === 'lent' ? 'arrow-up-circle' : 'arrow-down-circle'}
                    size={32}
                    color={debtType === 'lent' ? '#06D6A0' : '#FF6B6B'}
                />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.previewLabel, { color: themeColors.textSecondary }]}>
                        {debtType === 'lent' ? 'They owe you' : 'You owe them'}
                    </Text>
                    <Text style={[styles.previewAmount, { color: themeColors.text }]}>
                        ${amount || '0.00'}
                    </Text>
                    <Text style={[styles.previewPerson, { color: themeColors.textSecondary }]}>
                        {personName || 'Person Name'}
                    </Text>
                </View>
            </View>

            {/* Save Button */}
            <View style={styles.footer}>
                <Button
                    title={isEditMode ? 'Update Debt' : 'Create Debt'}
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
        sectionTitle: {
            ...typography.h3,
            marginBottom: spacing.sm,
        },
        typeGrid: {
            flexDirection: 'row',
            gap: spacing.md,
        },
        typeOption: {
            flex: 1,
            alignItems: 'center',
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            borderWidth: 2,
            backgroundColor: themeColors.surface,
        },
        typeLabel: {
            ...typography.body,
            fontWeight: '600',
            marginTop: spacing.sm,
            textAlign: 'center',
        },
        typeSubtext: {
            ...typography.caption,
            marginTop: spacing.xs,
        },
        dateButton: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            gap: spacing.sm,
        },
        dateText: {
            ...typography.body,
            flex: 1,
        },
        preview: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            gap: spacing.md,
            marginTop: spacing.md,
        },
        previewLabel: {
            ...typography.caption,
        },
        previewAmount: {
            ...typography.h2,
            fontWeight: '700',
            marginVertical: spacing.xs,
        },
        previewPerson: {
            ...typography.body,
        },
        footer: {
            marginTop: spacing.lg,
        },
    });
