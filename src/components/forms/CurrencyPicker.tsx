import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { CURRENCIES, Currency, getCurrencyByCode } from '../../constants/currencies';

interface CurrencyPickerProps {
    selectedCurrency: string; // Currency code
    onSelectCurrency: (currencyCode: string) => void;
    label?: string;
    error?: string;
    disabled?: boolean;
}

export const CurrencyPicker: React.FC<CurrencyPickerProps> = ({
    selectedCurrency,
    onSelectCurrency,
    label = 'Currency',
    error,
    disabled = false,
}) => {
    const themeColors = useThemeColors();
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const selectedCurrencyObj = getCurrencyByCode(selectedCurrency);

    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    // Filter currencies based on search
    const filteredCurrencies = useMemo(() => {
        if (!searchQuery) return CURRENCIES;

        const query = searchQuery.toLowerCase();
        return CURRENCIES.filter(
            (c) =>
                c.code.toLowerCase().includes(query) ||
                c.name.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    const handleSelect = (currency: Currency) => {
        onSelectCurrency(currency.code);
        setModalVisible(false);
        setSearchQuery('');
    };

    const renderCurrencyItem = ({ item }: { item: Currency }) => {
        const isSelected = item.code === selectedCurrency;

        return (
            <TouchableOpacity
                style={[styles.currencyItem, isSelected && styles.currencyItemSelected]}
                onPress={() => handleSelect(item)}
            >
                <Text style={styles.currencyFlag}>{item.flag}</Text>
                <View style={styles.currencyInfo}>
                    <Text style={styles.currencyCode}>{item.code}</Text>
                    <Text style={styles.currencyName}>{item.name}</Text>
                </View>
                <Text style={styles.currencySymbol}>{item.symbol}</Text>
                {isSelected && (
                    <Icon name="check-circle" size={20} color={themeColors.primary} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Label */}
            {label && <Text style={styles.label}>{label}</Text>}

            {/* Selected Currency Display */}
            <TouchableOpacity
                style={[
                    styles.selector,
                    error && styles.selectorError,
                    disabled && styles.selectorDisabled,
                ]}
                onPress={() => !disabled && setModalVisible(true)}
                disabled={disabled}
            >
                <View style={styles.selectedContent}>
                    {selectedCurrencyObj ? (
                        <>
                            <Text style={styles.selectedFlag}>{selectedCurrencyObj.flag}</Text>
                            <Text style={styles.selectedCurrency}>
                                {selectedCurrencyObj.code} - {selectedCurrencyObj.symbol}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.placeholder}>Select currency</Text>
                    )}
                </View>
                <Icon
                    name={modalVisible ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={themeColors.textSecondary}
                />
            </TouchableOpacity>

            {/* Error Message */}
            {error && <Text style={styles.error}>{error}</Text>}

            {/* Currency Selection Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Currency</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={themeColors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={styles.searchContainer}>
                            <Icon
                                name="magnify"
                                size={20}
                                color={themeColors.textSecondary}
                                style={styles.searchIcon}
                            />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search currencies..."
                                placeholderTextColor={themeColors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Icon
                                        name="close-circle"
                                        size={20}
                                        color={themeColors.textSecondary}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Currency List */}
                        <FlashList estimatedItemSize={56}
                            data={filteredCurrencies}
                            keyExtractor={(item) => item.code}
                            renderItem={renderCurrencyItem}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No currencies found</Text>
                            }
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
    StyleSheet.create({
        container: {
            marginBottom: spacing.md,
        },
        label: {
            ...typography.body,
            fontWeight: '500',
            color: themeColors.textSecondary,
            marginBottom: spacing.xs,
        },
        selector: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: themeColors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: themeColors.border,
            padding: spacing.md,
        },
        selectorError: {
            borderColor: themeColors.error,
        },
        selectorDisabled: {
            opacity: 0.5,
        },
        selectedContent: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        selectedFlag: {
            fontSize: 24,
            marginRight: spacing.sm,
        },
        selectedCurrency: {
            ...typography.body,
            color: themeColors.text,
            fontWeight: '600',
        },
        placeholder: {
            ...typography.body,
            color: themeColors.textSecondary,
        },
        error: {
            ...typography.caption,
            color: themeColors.error,
            marginTop: spacing.xs,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
        },
        modalContent: {
            backgroundColor: themeColors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '80%',
            paddingBottom: spacing.xl,
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border,
        },
        modalTitle: {
            ...typography.h3,
            color: themeColors.text,
            fontWeight: '600',
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: themeColors.surface,
            borderRadius: 12,
            margin: spacing.lg,
            paddingHorizontal: spacing.md,
        },
        searchIcon: {
            marginRight: spacing.sm,
        },
        searchInput: {
            flex: 1,
            ...typography.body,
            color: themeColors.text,
            paddingVertical: spacing.md,
        },
        currencyItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.md,
            marginHorizontal: spacing.lg,
            borderRadius: 12,
            marginBottom: spacing.xs,
        },
        currencyItemSelected: {
            backgroundColor: themeColors.primary + '15',
        },
        currencyFlag: {
            fontSize: 28,
            marginRight: spacing.md,
        },
        currencyInfo: {
            flex: 1,
        },
        currencyCode: {
            ...typography.body,
            color: themeColors.text,
            fontWeight: '600',
        },
        currencyName: {
            ...typography.caption,
            color: themeColors.textSecondary,
        },
        currencySymbol: {
            ...typography.body,
            color: themeColors.textSecondary,
            marginRight: spacing.sm,
        },
        emptyText: {
            ...typography.body,
            color: themeColors.textSecondary,
            textAlign: 'center',
            marginTop: spacing.xl,
        },
    });
