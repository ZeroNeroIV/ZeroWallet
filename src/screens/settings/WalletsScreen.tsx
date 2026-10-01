/**
 * Purpose: Manage wallets — add, rename, restyle, and remove wallets
 *
 * Inputs: None (settings screen; uses current account + user)
 *
 * Outputs:
 *   - Returns (JSX.Element): Wallet list with editor modal
 *
 * Side effects:
 *   - Creates/updates/deletes wallet rows (defaults can't be deleted and
 *     custom wallets with transactions are protected)
 */

import React, { useMemo, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { getWalletBalance } from '../../utils/wallets';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { useWallets } from '../../hooks/useWallets';
import { syncBalancesFromDatabase } from '../../services/walletTransferService';
import type { Wallet } from '../../types/models';

const ICON_PRESETS = [
  'wallet-outline',
  'cash-multiple',
  'piggy-bank-outline',
  'credit-card-outline',
  'bank',
  'cash',
  'lifebuoy',
  'repeat',
  'trending-up',
  'gift',
  'car',
  'home',
];

const COLOR_PRESETS = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#A8E6CF',
  '#FF8B94',
  '#B4A7D6',
  '#89CFF0',
  '#06D6A0',
  '#118AB2',
  '#FFD166',
  '#EF476F',
  '#3A86FF',
];

export default function WalletsScreen() {
  const themeColors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId);
  const balances = useAccountStore((s) => s.balances);
  const { wallets, loading, refresh } = useWallets();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [currency, setCurrency] = useState('USD');

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (currentAccountId) {
        syncBalancesFromDatabase(currentAccountId);
        import('../../database/repositories/AccountRepository').then(({ AccountRepository }) => {
          new AccountRepository().findById(currentAccountId).then((acc) => {
            if (acc?.currency) setCurrency(acc.currency);
          });
        });
      }
    }, [refresh, currentAccountId])
  );

  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_PRESETS[0]);
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    lightHaptic();
    setEditing(null);
    setName('');
    setIcon(ICON_PRESETS[0]);
    setColor(COLOR_PRESETS[0]);
    setEditorVisible(true);
  };

  const openEdit = (wallet: Wallet) => {
    lightHaptic();
    setEditing(wallet);
    setName(wallet.name);
    setIcon(wallet.icon);
    setColor(wallet.color);
    setEditorVisible(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give your wallet a name first.');
      return;
    }
    if (!currentAccountId) {
      Alert.alert('Error', 'No active account.');
      return;
    }
    // Name must stay unique per account (case-insensitive)
    const clash = wallets.find(
      (w) => w.id !== editing?.id && w.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (clash) {
      Alert.alert('Name taken', `You already have a wallet called “${clash.name}”.`);
      return;
    }
    setSaving(true);
    try {
      const repo = new WalletRepository();
      if (editing) {
        await repo.update(editing.id, { name: trimmed, icon, color, accountId: editing.accountId || currentAccountId }, editing.accountId || currentAccountId);
        mediumHaptic();
      } else {
        await repo.create({
          accountId: currentAccountId,
          name: trimmed,
          icon,
          color,
          isDefault: false,
        });
        mediumHaptic();
      }
      setEditorVisible(false);
      await refresh();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not save the wallet.');
    } finally {
      setSaving(false);
    }
  };

  const [reassignVisible, setReassignVisible] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState<Wallet | null>(null);
  const [targetWalletId, setTargetWalletId] = useState<string>('');
  const [usageDetails, setUsageDetails] = useState<{
    transactions: number;
    subscriptions: number;
    recurring: number;
  }>({ transactions: 0, subscriptions: 0, recurring: 0 });
  const [deleting, setDeleting] = useState(false);

  const otherWallets = useMemo(() => {
    if (!walletToDelete) return [];
    return wallets.filter((w) => w.id !== walletToDelete.id);
  }, [wallets, walletToDelete]);

  const handleDelete = async (wallet: Wallet) => {
    if (wallets.length <= 1) {
      Alert.alert('Cannot Delete', 'An account must have at least one wallet.');
      return;
    }

    try {
      const repo = new WalletRepository();
      const usage = await repo.getWalletUsage(wallet.id, wallet.accountId || currentAccountId || undefined);
      const totalUsage = usage.transactions + usage.subscriptions + usage.recurring;

      if (totalUsage === 0) {
        Alert.alert(
          'Delete Wallet',
          `Are you sure you want to delete “${wallet.name}”?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await repo.delete(wallet.id, wallet.accountId || currentAccountId || undefined);
                  mediumHaptic();
                  if (currentAccountId) await syncBalancesFromDatabase(currentAccountId);
                  await refresh();
                } catch (error: any) {
                  Alert.alert('Cannot Delete', error?.message || 'Could not delete the wallet.');
                }
              },
            },
          ]
        );
      } else {
        const remaining = wallets.filter((w) => w.id !== wallet.id);
        setWalletToDelete(wallet);
        setUsageDetails(usage);
        setTargetWalletId(remaining[0]?.id || '');
        setReassignVisible(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not check wallet usage.');
    }
  };

  const handleConfirmReassignAndDelete = async () => {
    if (!walletToDelete || !targetWalletId) return;
    setDeleting(true);
    try {
      const repo = new WalletRepository();
      await repo.delete(
        walletToDelete.id,
        walletToDelete.accountId || currentAccountId || undefined,
        targetWalletId
      );
      mediumHaptic();
      setReassignVisible(false);
      setWalletToDelete(null);
      if (currentAccountId) await syncBalancesFromDatabase(currentAccountId);
      await refresh();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to reassign and delete wallet.');
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0 || !currentAccountId) return;
    const reordered = [...wallets];
    const temp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = temp;
    lightHaptic();
    try {
      await new WalletRepository().reorderWallets(currentAccountId, reordered.map((w) => w.id));
      await refresh();
    } catch (e: any) {
      console.warn('Failed to reorder wallets:', e);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index >= wallets.length - 1 || !currentAccountId) return;
    const reordered = [...wallets];
    const temp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = temp;
    lightHaptic();
    try {
      await new WalletRepository().reorderWallets(currentAccountId, reordered.map((w) => w.id));
      await refresh();
    } catch (e: any) {
      console.warn('Failed to reorder wallets:', e);
    }
  };

  const renderItem = ({ item, index }: { item: Wallet; index: number }) => {
    const balance = currentAccountId
      ? getWalletBalance(balances[currentAccountId] as any, item.id)
      : 0;
    return (
      <View style={styles.card}>
        <View style={styles.reorderActions}>
          <TouchableOpacity
            style={[styles.miniAction, index === 0 && styles.miniActionDisabled]}
            disabled={index === 0}
            onPress={() => handleMoveUp(index)}
            hitSlop={6}
          >
            <MaterialCommunityIcons
              name="chevron-up"
              size={20}
              color={index === 0 ? themeColors.textDisabled : themeColors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.miniAction, index === wallets.length - 1 && styles.miniActionDisabled]}
            disabled={index === wallets.length - 1}
            onPress={() => handleMoveDown(index)}
            hitSlop={6}
          >
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={index === wallets.length - 1 ? themeColors.textDisabled : themeColors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
          <MaterialCommunityIcons name={item.icon as any} size={22} color="#FFF" />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.balance}>{balance.toFixed(3)} {currency}</Text>
          {item.isDefault && <Text style={styles.badge}>STARTER</Text>}
        </View>
        <TouchableOpacity style={styles.action} onPress={() => openEdit(item)} hitSlop={8}>
          <MaterialCommunityIcons name="pencil" size={20} color={themeColors.primary} />
        </TouchableOpacity>
        {wallets.length > 1 && (
          <TouchableOpacity style={styles.action} onPress={() => handleDelete(item)} hitSlop={8}>
            <MaterialCommunityIcons name="delete" size={20} color={themeColors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlashList
        data={wallets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={themeColors.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="wallet-outline" size={48} color={themeColors.textSecondary} />
              <Text style={styles.emptyText}>No wallets yet</Text>
            </View>
          )
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
          <Text style={styles.addText}>Add Wallet</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editing ? 'Edit Wallet' : 'New Wallet'}</Text>
              <TouchableOpacity onPress={() => setEditorVisible(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Holiday fund"
              placeholderTextColor={themeColors.textSecondary}
              maxLength={30}
              autoFocus
            />

            <Text style={styles.fieldLabel}>Icon</Text>
            <View style={styles.optionGrid}>
              {ICON_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.iconOption, icon === preset && styles.iconOptionActive]}
                  onPress={() => setIcon(preset)}
                >
                  <MaterialCommunityIcons
                    name={preset as any}
                    size={24}
                    color={icon === preset ? themeColors.primary : themeColors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.optionGrid}>
              {COLOR_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.colorOption, { backgroundColor: preset }, color === preset && styles.colorOptionActive]}
                  onPress={() => setColor(preset)}
                >
                  {color === preset && (
                    <MaterialCommunityIcons name="check" size={18} color="#FFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveText}>{editing ? 'Save Changes' : 'Add Wallet'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reassign & Delete Modal */}
      <Modal
        visible={reassignVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setReassignVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Reassign & Delete</Text>
              {!deleting && (
                <TouchableOpacity onPress={() => setReassignVisible(false)} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={24} color={themeColors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.warningBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={24} color={themeColors.warning} />
              <Text style={styles.warningText}>
                “{walletToDelete?.name}” has {usageDetails.transactions} transaction(s)
                {usageDetails.subscriptions > 0 ? `, ${usageDetails.subscriptions} subscription(s)` : ''}
                {usageDetails.recurring > 0 ? `, ${usageDetails.recurring} recurring item(s)` : ''}.
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Reassign records to:</Text>
            <ScrollView style={styles.walletPickerList}>
              {otherWallets.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.walletPickerItem,
                    targetWalletId === w.id && styles.walletPickerItemActive,
                  ]}
                  onPress={() => {
                    lightHaptic();
                    setTargetWalletId(w.id);
                  }}
                >
                  <View style={[styles.iconCircleSmall, { backgroundColor: w.color }]}>
                    <MaterialCommunityIcons name={w.icon as any} size={18} color="#FFF" />
                  </View>
                  <Text style={styles.walletPickerText}>{w.name}</Text>
                  {targetWalletId === w.id && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={themeColors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.deleteConfirmButton, deleting && styles.buttonDisabled]}
              onPress={handleConfirmReassignAndDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.deleteConfirmText}>Reassign & Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    list: {
      padding: spacing.md,
      gap: spacing.sm,
      paddingBottom: spacing.xl,
    },
    loader: {
      marginTop: spacing.xl,
    },
    empty: {
      alignItems: 'center',
      paddingTop: spacing.xxl,
      gap: spacing.sm,
    },
    emptyText: {
      ...typography.body,
      color: themeColors.textSecondary,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    reorderActions: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: -4,
    },
    miniAction: {
      padding: 2,
    },
    miniActionDisabled: {
      opacity: 0.25,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      gap: 2,
    },
    name: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
    },
    balance: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    badge: {
      ...typography.caption,
      fontSize: 10,
      fontWeight: '700',
      color: themeColors.primary,
      letterSpacing: 0.5,
    },
    action: {
      padding: spacing.xs,
    },
    footer: {
      padding: spacing.md,
      backgroundColor: themeColors.surface,
      borderTopWidth: 1,
      borderTopColor: themeColors.border,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    addText: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFF',
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
      maxHeight: '85%',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sheetTitle: {
      ...typography.h3,
      color: themeColors.text,
    },
    fieldLabel: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.text,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    nameInput: {
      ...typography.body,
      color: themeColors.text,
      backgroundColor: themeColors.background,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    iconOption: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: themeColors.border,
      backgroundColor: themeColors.background,
    },
    iconOptionActive: {
      borderColor: themeColors.primary,
    },
    colorOption: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: 'transparent',
    },
    colorOptionActive: {
      borderColor: themeColors.text,
    },
    saveButton: {
      backgroundColor: themeColors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    saveText: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFF',
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: themeColors.warning + '20',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: themeColors.warning + '40',
    },
    warningText: {
      ...typography.caption,
      color: themeColors.text,
      flex: 1,
      lineHeight: 18,
    },
    walletPickerList: {
      maxHeight: 180,
      marginVertical: spacing.xs,
    },
    walletPickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginBottom: spacing.xs,
      gap: spacing.sm,
      backgroundColor: themeColors.background,
    },
    walletPickerItemActive: {
      borderColor: themeColors.primary,
      backgroundColor: themeColors.primary + '15',
    },
    iconCircleSmall: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    walletPickerText: {
      ...typography.body,
      flex: 1,
      fontWeight: '600',
      color: themeColors.text,
    },
    deleteConfirmButton: {
      backgroundColor: themeColors.error,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    deleteConfirmText: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFF',
    },
  });
