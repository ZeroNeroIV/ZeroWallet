import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { syncBalancesFromDatabase } from '../../services/walletTransferService';
import type { Category, Wallet } from '../../types/models';

interface FloatingFastLogProps {
  accountId: string;
  currency: string;
  wallets: Wallet[];
  onLogged?: () => void;
}

export const FloatingFastLog: React.FC<FloatingFastLogProps> = ({
  accountId,
  currency,
  wallets,
  onLogged,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [visible, setVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [saving, setSaving] = useState(false);

  const openSheet = async () => {
    lightHaptic();
    try {
      const catRepo = new CategoryRepository();
      const allCats = await catRepo.findAll();
      const expenseCats = allCats.filter((c) => c.type === 'expense');
      setCategories(allCats);
      setSelectedCatId(expenseCats[0]?.id || allCats[0]?.id || '');
      setSelectedWalletId(wallets[0]?.id || 'main');
      setAmountStr('');
      setType('expense');
      setVisible(true);
    } catch (err) {
      console.warn('Failed to load categories:', err);
    }
  };

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  const handleSave = async () => {
    const val = parseFloat(amountStr);
    if (!val || val <= 0) {
      Alert.alert('Amount Required', 'Please enter a valid amount.');
      return;
    }
    if (!selectedCatId) {
      Alert.alert('Category Required', 'Please select a category.');
      return;
    }

    setSaving(true);
    try {
      const txRepo = new TransactionRepository();
      const cat = categories.find((c) => c.id === selectedCatId);
      await txRepo.create({
        accountId,
        type,
        amount: val,
        categoryId: selectedCatId,
        description: cat?.name || (type === 'expense' ? 'Quick Expense' : 'Quick Income'),
        date: Date.now(),
        vaultType: selectedWalletId || 'main',
        isRecurring: false,
        currency,
      });

      mediumHaptic();
      await syncBalancesFromDatabase(accountId);
      setVisible(false);
      if (onLogged) onLogged();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to fast log transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={openSheet}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="lightning-bolt" size={24} color="#FFF" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[styles.typeButton, type === 'expense' && styles.typeButtonActiveExpense]}
                  onPress={() => {
                    lightHaptic();
                    setType('expense');
                  }}
                >
                  <Text
                    style={[styles.typeText, type === 'expense' && styles.typeTextActive]}
                  >
                    Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, type === 'income' && styles.typeButtonActiveIncome]}
                  onPress={() => {
                    lightHaptic();
                    setType('income');
                  }}
                >
                  <Text
                    style={[styles.typeText, type === 'income' && styles.typeTextActive]}
                  >
                    Income
                  </Text>
                </TouchableOpacity>
              </View>

              {!saving && (
                <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={24} color={themeColors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Amount input */}
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>{currency}</Text>
              <TextInput
                style={styles.amountInput}
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder="0.00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {/* Quick Categories */}
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.catGrid}>
              {filteredCategories.slice(0, 6).map((c) => {
                const selected = selectedCatId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.catCard,
                      selected && {
                        borderColor: themeColors.primary,
                        backgroundColor: themeColors.primary + '15',
                      },
                    ]}
                    onPress={() => {
                      lightHaptic();
                      setSelectedCatId(c.id);
                    }}
                  >
                    <MaterialCommunityIcons
                      name={c.icon as any}
                      size={20}
                      color={selected ? themeColors.primary : themeColors.textSecondary}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.catLabel,
                        selected && { color: themeColors.primary, fontWeight: '700' },
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick Wallet Choice */}
            {wallets.length > 1 && (
              <>
                <Text style={styles.fieldLabel}>Wallet</Text>
                <View style={styles.walletRow}>
                  {wallets.slice(0, 4).map((w) => {
                    const selected = selectedWalletId === w.id;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[
                          styles.walletChip,
                          selected && {
                            borderColor: themeColors.primary,
                            backgroundColor: themeColors.primary + '15',
                          },
                        ]}
                        onPress={() => {
                          lightHaptic();
                          setSelectedWalletId(w.id);
                        }}
                      >
                        <View style={[styles.walletDot, { backgroundColor: w.color }]} />
                        <Text
                          style={[
                            styles.walletText,
                            selected && { color: themeColors.primary, fontWeight: '700' },
                          ]}
                        >
                          {w.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.saveButton,
                type === 'expense' ? { backgroundColor: themeColors.error } : { backgroundColor: themeColors.success },
                saving && styles.disabledBtn,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveText}>
                  Fast Log {type === 'expense' ? 'Expense' : 'Income'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    floatingButton: {
      position: 'absolute',
      bottom: 80,
      right: spacing.lg,
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: themeColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
      zIndex: 99,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    typeToggle: {
      flexDirection: 'row',
      backgroundColor: themeColors.background,
      borderRadius: borderRadius.md,
      padding: 3,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    typeButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: borderRadius.sm,
    },
    typeButtonActiveExpense: {
      backgroundColor: themeColors.error,
    },
    typeButtonActiveIncome: {
      backgroundColor: themeColors.success,
    },
    typeText: {
      ...typography.caption,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    typeTextActive: {
      color: '#FFF',
      fontWeight: '700',
    },
    amountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.md,
    },
    currencySymbol: {
      ...typography.h2,
      fontWeight: '700',
      color: themeColors.textSecondary,
      marginRight: spacing.xs,
    },
    amountInput: {
      ...typography.h1,
      fontWeight: '800',
      color: themeColors.text,
      minWidth: 120,
      textAlign: 'center',
    },
    fieldLabel: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    catGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    catCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.background,
      minWidth: '30%',
    },
    catLabel: {
      ...typography.caption,
      color: themeColors.text,
      flex: 1,
    },
    walletRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    walletChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.background,
    },
    walletDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    walletText: {
      ...typography.caption,
      color: themeColors.text,
    },
    saveButton: {
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    disabledBtn: {
      opacity: 0.6,
    },
    saveText: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFF',
    },
  });
