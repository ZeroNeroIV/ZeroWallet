import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
    convertCurrency,
    getExchangeRate,
    areCachedRatesStale,
} from '../../services/currencyService';
import {
    getCurrencyByCode,
    formatCurrency,
} from '../../constants/currencies';

interface CurrencyConversionModalProps {
    visible: boolean;
    onClose: () => void;
    fromCurrency: string;
    toCurrency: string;
    initialAmount?: number;
    onConversionComplete?: (result: {
        amount: number;
        convertedAmount: number;
        exchangeRate: number;
    }) => void;
}

export const CurrencyConversionModal: React.FC<CurrencyConversionModalProps> = ({
    visible,
    onClose,
    fromCurrency,
    toCurrency,
    initialAmount = 0,
    onConversionComplete,
}) => {
    const themeColors = useThemeColors();
    const [amount, setAmount] = useState(initialAmount.toString());
    const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    const fromCurrencyObj = getCurrencyByCode(fromCurrency);
    const toCurrencyObj = getCurrencyByCode(toCurrency);

    // Fetch exchange rate and convert when modal opens or currencies change
    useEffect(() => {
        if (visible && fromCurrency && toCurrency) {
            fetchAndConvert();
        }
    }, [visible, fromCurrency, toCurrency]);

    // Update conversion when amount changes
    useEffect(() => {
        if (amount && exchangeRate && !loading) {
            const numAmount = parseFloat(amount);
            if (!isNaN(numAmount)) {
                setConvertedAmount(numAmount * exchangeRate);
            }
        }
    }, [amount, exchangeRate]);

    const fetchAndConvert = async () => {
        setLoading(true);
        try {
            const rate = await getExchangeRate(fromCurrency, toCurrency);
            setExchangeRate(rate);
            setLastUpdate(new Date());

            // Convert initial amount if provided
            if (amount) {
                const numAmount = parseFloat(amount);
                if (!isNaN(numAmount)) {
                    setConvertedAmount(numAmount * rate);
                }
            }

            // Check if rates are stale
            if (areCachedRatesStale()) {
                Alert.alert(
                    'Stale Exchange Rates',
                    'The exchange rates are more than 24 hours old. Results may not be accurate.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('[CurrencyConversion] Failed to fetch exchange rate:', error);
            Alert.alert(
                'Error',
                'Failed to fetch exchange rates. Please check your internet connection.',
                [{ text: 'OK' }]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSwapCurrencies = () => {
        // Swap the currencies and amounts
        if (convertedAmount) {
            setAmount(convertedAmount.toFixed(3));
        }
        if (exchangeRate) {
            setExchangeRate(1 / exchangeRate);
        }
    };

    const handleUseConversion = () => {
        if (convertedAmount && exchangeRate) {
            const numAmount = parseFloat(amount);
            if (!isNaN(numAmount)) {
                onConversionComplete?.({
                    amount: numAmount,
                    convertedAmount,
                    exchangeRate,
                });
                onClose();
            }
        }
    };

    const handleClose = () => {
        setAmount(initialAmount.toString());
        setConvertedAmount(null);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Currency Conversion</Text>
                        <TouchableOpacity onPress={handleClose}>
                            <Icon name="close" size={24} color={themeColors.text} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={themeColors.primary} />
                            <Text style={styles.loadingText}>Fetching exchange rates...</Text>
                        </View>
                    ) : (
                        <>
                            {/* From Currency */}
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>From</Text>
                                <View style={styles.currencyRow}>
                                    <View style={styles.currencyInfo}>
                                        <Text style={styles.currencyFlag}>
                                            {fromCurrencyObj?.flag}
                                        </Text>
                                        <Text style={styles.currencyCode}>{fromCurrency}</Text>
                                    </View>
                                    <TextInput
                                        style={styles.amountInput}
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="decimal-pad"
                                        placeholder="0.000"
                                        placeholderTextColor={themeColors.textSecondary}
                                    />
                                </View>
                            </View>

                            {/* Swap Button */}
                            <View style={styles.swapContainer}>
                                <TouchableOpacity
                                    style={styles.swapButton}
                                    onPress={handleSwapCurrencies}
                                >
                                    <Icon name="swap-vertical" size={24} color={themeColors.primary} />
                                </TouchableOpacity>
                                {exchangeRate && (
                                    <Text style={styles.rateText}>
                                        1 {fromCurrency} = {exchangeRate.toFixed(4)} {toCurrency}
                                    </Text>
                                )}
                            </View>

                            {/* To Currency */}
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>To</Text>
                                <View style={styles.currencyRow}>
                                    <View style={styles.currencyInfo}>
                                        <Text style={styles.currencyFlag}>
                                            {toCurrencyObj?.flag}
                                        </Text>
                                        <Text style={styles.currencyCode}>{toCurrency}</Text>
                                    </View>
                                    <Text style={styles.convertedAmount}>
                                        {convertedAmount !== null
                                            ? convertedAmount.toFixed(3)
                                            : '0.000'}
                                    </Text>
                                </View>
                            </View>

                            {/* Last Update Info */}
                            {lastUpdate && (
                                <Text style={styles.updateInfo}>
                                    Last updated: {lastUpdate.toLocaleTimeString()}
                                </Text>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[styles.button, styles.secondaryButton]}
                                    onPress={handleClose}
                                >
                                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, styles.primaryButton]}
                                    onPress={handleUseConversion}
                                    disabled={!convertedAmount}
                                >
                                    <Text style={styles.primaryButtonText}>Use Conversion</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            padding: spacing.lg,
        },
        content: {
            backgroundColor: themeColors.background,
            borderRadius: 24,
            padding: spacing.xl,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.xl,
        },
        title: {
            ...typography.h2,
            color: themeColors.text,
            fontWeight: '600',
        },
        loadingContainer: {
            alignItems: 'center',
            paddingVertical: spacing.xl,
        },
        loadingText: {
            ...typography.body,
            color: themeColors.textSecondary,
            marginTop: spacing.md,
        },
        section: {
            marginBottom: spacing.lg,
        },
        sectionLabel: {
            ...typography.caption,
            color: themeColors.textSecondary,
            marginBottom: spacing.sm,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        currencyRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: themeColors.surface,
            borderRadius: 16,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: themeColors.border,
        },
        currencyInfo: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        currencyFlag: {
            fontSize: 32,
            marginRight: spacing.sm,
        },
        currencyCode: {
            ...typography.h3,
            color: themeColors.text,
            fontWeight: '600',
        },
        amountInput: {
            ...typography.h3,
            color: themeColors.text,
            fontWeight: '600',
            textAlign: 'right',
            minWidth: 100,
        },
        convertedAmount: {
            ...typography.h3,
            color: themeColors.primary,
            fontWeight: '600',
        },
        swapContainer: {
            alignItems: 'center',
            marginVertical: spacing.md,
        },
        swapButton: {
            backgroundColor: themeColors.primary + '15',
            borderRadius: 24,
            padding: spacing.sm,
            marginBottom: spacing.xs,
        },
        rateText: {
            ...typography.caption,
            color: themeColors.textSecondary,
            marginTop: spacing.xs,
        },
        updateInfo: {
            ...typography.caption,
            color: themeColors.textSecondary,
            textAlign: 'center',
            marginTop: spacing.md,
            marginBottom: spacing.lg,
        },
        actions: {
            flexDirection: 'row',
            gap: spacing.md,
            marginTop: spacing.lg,
        },
        button: {
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: 12,
            alignItems: 'center',
        },
        primaryButton: {
            backgroundColor: themeColors.primary,
        },
        primaryButtonText: {
            ...typography.body,
            color: '#FFFFFF',
            fontWeight: '600',
        },
        secondaryButton: {
            backgroundColor: themeColors.surface,
            borderWidth: 1,
            borderColor: themeColors.border,
        },
        secondaryButtonText: {
            ...typography.body,
            color: themeColors.text,
            fontWeight: '600',
        },
    });
