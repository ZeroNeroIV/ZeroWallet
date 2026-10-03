import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
    Currency,
    getCurrencyByCode,
    searchCurrencies,
} from '../../constants/currencies';

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

    // Filter currencies based on search (matches code, name, symbol, and aliases like JD)
    const filteredCurrencies = useMemo(() => {
        return searchCurrencies(searchQuery);
    }, [searchQuery]);

    const handleSelect = (currency: Currency) => {
        onSelectCurrency(currency.code);
        setModalVisible(false);
        setSearchQuery('');
    };

    const handleClose = () => {
        setModalVisible(false);
        setSearchQuery('');
    };

    const renderCurrencyItem = ({ item }: { item: Currency }) => {
        const isSelected = item.code.toUpperCase() === (selectedCurrency || '').trim().toUpperCase();

        return (
            <TouchableOpacity
                style={[styles.currencyItem, isSelected && styles.currencyItemSelected]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
            >
                <Text style={styles.currencyFlag}>{item.flag}</Text>
                <View style={styles.currencyInfo}>
                    <Text style={styles.currencyCode}>{item.code}</Text>
                    <Text style={styles.currencyName}>{item.name}</Text>
                </View>
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
                activeOpacity={0.7}
            >
                <View style={styles.selectedContent}>
                    {selectedCurrencyObj ? (
                        <>
                            <Text style={styles.selectedFlag}>{selectedCurrencyObj.flag}</Text>
                            <Text style={styles.selectedCurrency}>
                                {selectedCurrencyObj.code}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.placeholder}>
                            {selectedCurrency ? `${selectedCurrency} (Select currency)` : 'Select currency'}
                        </Text>
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
                onRequestClose={handleClose}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={handleClose}
                    />
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Currency</Text>
                            <TouchableOpacity
                                onPress={handleClose}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
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
                                placeholder="Search currencies (e.g., USD, JOD, JD)..."
                                placeholderTextColor={themeColors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus={false}
                                returnKeyType="done"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setSearchQuery('')}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Icon
                                        name="close-circle"
                                        size={20}
                                        color={themeColors.textSecondary}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Currency List Container with bounded height */}
                        <View style={styles.listContainer}>
                            <FlashList
                                data={filteredCurrencies}
                                estimatedItemSize={60}
                                keyExtractor={(item) => item.code}
                                renderItem={renderCurrencyItem}
                                showsVerticalScrollIndicator={true}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Icon
                                            name="currency-usd-off"
                                            size={48}
                                            color={themeColors.textSecondary}
                                        />
                                        <Text style={styles.emptyText}>No currencies found</Text>
                                    </View>
                                }
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
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
        modalBackdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        modalContent: {
            backgroundColor: themeColors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            height: '75%',
            maxHeight: '85%',
            paddingBottom: spacing.md,
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
        listContainer: {
            flex: 1,
        },
        listContent: {
            paddingBottom: spacing.lg,
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
        emptyContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.xxl,
        },
        emptyText: {
            ...typography.body,
            color: themeColors.textSecondary,
            textAlign: 'center',
            marginTop: spacing.sm,
        },
    });
