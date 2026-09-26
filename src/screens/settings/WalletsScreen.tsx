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

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
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
        await repo.update(editing.id, { name: trimmed, icon, color });
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

  const handleDelete = (wallet: Wallet) => {
    if (wallet.isDefault) {
      Alert.alert('Cannot Delete', 'Built-in wallets cannot be deleted, but you can rename them.');
      return;
    }
    Alert.alert(
      'Delete Wallet',
      `Delete “${wallet.name}”? Only wallets with no transactions can be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await new WalletRepository().delete(wallet.id);
              mediumHaptic();
              await refresh();
            } catch (error: any) {
              Alert.alert('Cannot Delete', error?.message || 'Could not delete the wallet.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Wallet }) => {
    const balance = currentAccountId
      ? getWalletBalance(balances[currentAccountId], item.id)
      : 0;
    return (
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
          <MaterialCommunityIcons name={item.icon as any} size={22} color="#FFF" />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.balance}>{balance.toFixed(3)}</Text>
          {item.isDefault && <Text style={styles.badge}>BUILT-IN</Text>}
        </View>
        <TouchableOpacity style={styles.action} onPress={() => openEdit(item)} hitSlop={8}>
          <MaterialCommunityIcons name="pencil" size={20} color={themeColors.primary} />
        </TouchableOpacity>
        {!item.isDefault && (
          <TouchableOpacity style={styles.action} onPress={() => handleDelete(item)} hitSlop={8}>
            <MaterialCommunityIcons name="delete" size={20} color={themeColors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
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
      gap: spacing.md,
      borderWidth: 1,
      borderColor: themeColors.border,
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
  });
