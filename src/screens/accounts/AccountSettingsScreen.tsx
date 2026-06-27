import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Input } from '../../components/forms/Input';
import { Button } from '../../components/forms/Button';
import { CurrencyPicker } from '../../components/forms/CurrencyPicker';
import { useAuthStore } from '../../store/authStore';
import { Account } from '../../types/models';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getCurrencyByCode } from '../../constants/currencies';

type AccountSettingsNavigationProp = StackNavigationProp<
    MainStackParamList,
    'AccountSettings'
>;

type AccountSettingsRouteProp = RouteProp<MainStackParamList, 'AccountSettings'>;

// Available account icons
const ACCOUNT_ICONS = [
    'wallet',
    'credit-card',
    'bank',
    'cash',
    'piggy-bank',
    'currency-usd',
];

// Available colors
const ACCOUNT_COLORS = [
    '#4ECDC4',
    '#FFE66D',
    '#FF6B6B',
    '#A8E6CF',
    '#FF8B94',
    '#B4A7D6',
    '#89CFF0',
    '#06D6A0',
];

export default function AccountSettingsScreen() {
    const navigation = useNavigation<AccountSettingsNavigationProp>();
    const route = useRoute<AccountSettingsRouteProp>();
    const currentUser = useAuthStore((state) => state.currentUser);
    const themeColors = useThemeColors();

    const [account, setAccount] = useState<Account | null>(null);
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('wallet');
    const [selectedColor, setSelectedColor] = useState('#4ECDC4');
    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ name?: string }>({});

    const styles = useMemo(() => createStyles(themeColors), [themeColors]);
    const accountRepo = new AccountRepository();

    // Load account data
    useEffect(() => {
        loadAccount();
    }, [route.params?.accountId]);

    const loadAccount = async () => {
        const accountId = route.params?.accountId;
        if (!accountId) {
            Alert.alert('Error', 'Account not found');
            navigation.goBack();
            return;
        }

        try {
            const loadedAccount = await accountRepo.findById(accountId);
            if (loadedAccount) {
                setAccount(loadedAccount);
                setName(loadedAccount.name);
                setSelectedIcon(loadedAccount.icon);
                setSelectedColor(loadedAccount.color);
                setSelectedCurrency(loadedAccount.currency);
            } else {
                Alert.alert('Error', 'Account not found');
                navigation.goBack();
            }
        } catch (error) {
            console.error('[AccountSettings] Error loading account:', error);
            Alert.alert('Error', 'Failed to load account');
            navigation.goBack();
        }
    };

    const handleSave = async () => {
        if (!account) return;

        if (!name.trim()) {
            setErrors({ name: 'Account name is required' });
            return;
        }

        setErrors({});
        setLoading(true);

        try {
            await accountRepo.update(account.id, {
                name: name.trim(),
                currency: selectedCurrency,
                icon: selectedIcon,
                color: selectedColor,
            });

            Alert.alert('Success', 'Account updated successfully', [
                {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                },
            ]);
        } catch (error) {
            console.error('[AccountSettings] Failed to update account:', error);
            Alert.alert('Error', 'Failed to update account');
        } finally {
            setLoading(false);
        }
    };

    if (!account) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    const currencyObj = getCurrencyByCode(selectedCurrency);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Input
                label="Account Name"
                placeholder="e.g., My Savings, Business Account"
                value={name}
                onChangeText={(text) => {
                    setName(text);
                    setErrors({});
                }}
                error={errors.name}
                leftIcon="wallet-outline"
                autoFocus
            />

            {/* Currency Selection */}
            <View style={styles.section}>
                <CurrencyPicker
                    selectedCurrency={selectedCurrency}
                    onSelectCurrency={setSelectedCurrency}
                    label="Account Currency"
                />
                {selectedCurrency !== account.currency && (
                    <View style={styles.warningBox}>
                        <Icon name="alert-circle" size={16} color={themeColors.warning} />
                        <Text style={styles.warningText}>
                            Changing currency will affect future transactions. Existing transactions will keep their original values.
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose Icon</Text>
                <View style={styles.iconGrid}>
                    {ACCOUNT_ICONS.map((icon) => (
                        <TouchableOpacity
                            key={icon}
                            style={[
                                styles.iconOption,
                                selectedIcon === icon && styles.iconOptionSelected,
                                { borderColor: selectedColor },
                            ]}
                            onPress={() => setSelectedIcon(icon)}
                        >
                            <Icon
                                name={icon}
                                size={32}
                                color={selectedIcon === icon ? selectedColor : themeColors.textSecondary}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose Color</Text>
                <View style={styles.colorGrid}>
                    {ACCOUNT_COLORS.map((color) => (
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
                                <Icon name="check" size={20} color={themeColors.surface} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.preview}>
                <Text style={styles.previewLabel}>Preview</Text>
                <View style={styles.previewCard}>
                    <View
                        style={[
                            styles.previewIcon,
                            { backgroundColor: selectedColor + '20' },
                        ]}
                    >
                        <Icon name={selectedIcon} size={32} color={selectedColor} />
                    </View>
                    <View style={styles.previewInfo}>
                        <Text style={styles.previewName}>{name || 'Account Name'}</Text>
                        <View style={styles.currencyRow}>
                            <Text style={styles.currencyFlag}>{currencyObj?.flag}</Text>
                            <Text style={styles.previewCurrency}>{selectedCurrency}</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.footer}>
                <Button
                    title="Save Changes"
                    onPress={handleSave}
                    loading={loading}
                    disabled={loading || !name.trim()}
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
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: themeColors.background,
        },
        loadingText: {
            ...typography.body,
            color: themeColors.textSecondary,
        },
        content: {
            padding: spacing.lg,
        },
        section: {
            marginTop: spacing.lg,
        },
        sectionTitle: {
            fontSize: typography.fontSize.md,
            fontWeight: typography.fontWeight.semiBold,
            color: themeColors.text,
            marginBottom: spacing.md,
        },
        warningBox: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: themeColors.warning + '15',
            borderLeftWidth: 3,
            borderLeftColor: themeColors.warning,
            marginTop: spacing.sm,
            padding: spacing.md,
            borderRadius: borderRadius.md,
            gap: spacing.sm,
        },
        warningText: {
            ...typography.caption,
            color: themeColors.text,
            flex: 1,
        },
        iconGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.md,
        },
        iconOption: {
            width: 64,
            height: 64,
            borderRadius: borderRadius.md,
            backgroundColor: themeColors.surface,
            borderWidth: 2,
            borderColor: themeColors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        iconOptionSelected: {
            borderWidth: 3,
        },
        colorGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.md,
        },
        colorOption: {
            width: 48,
            height: 48,
            borderRadius: borderRadius.round,
            justifyContent: 'center',
            alignItems: 'center',
        },
        colorOptionSelected: {
            borderWidth: 3,
            borderColor: themeColors.surface,
            shadowColor: themeColors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
        },
        preview: {
            marginTop: spacing.xl,
        },
        previewLabel: {
            fontSize: typography.fontSize.md,
            fontWeight: typography.fontWeight.semiBold,
            color: themeColors.text,
            marginBottom: spacing.md,
        },
        previewCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: themeColors.surface,
            padding: spacing.md,
            borderRadius: borderRadius.lg,
        },
        previewIcon: {
            width: 56,
            height: 56,
            borderRadius: borderRadius.md,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.md,
        },
        previewInfo: {
            flex: 1,
        },
        previewName: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semiBold,
            color: themeColors.text,
            marginBottom: spacing.xs,
        },
        currencyRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
        },
        currencyFlag: {
            fontSize: 16,
        },
        previewCurrency: {
            fontSize: typography.fontSize.sm,
            color: themeColors.textSecondary,
        },
        footer: {
            marginTop: spacing.xl,
            marginBottom: spacing.lg,
        },
    });
