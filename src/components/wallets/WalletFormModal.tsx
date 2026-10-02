// Simplizum Wallet Form Modal — Add / Edit Wallet with razor-thin styling
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import type { Wallet } from '../../types/models';

const ICON_OPTIONS = [
  'wallet-outline',
  'bank-outline',
  'credit-card-outline',
  'cash-multiple',
  'safe',
  'piggy-bank-outline',
  'shield-outline',
  'trending-up',
  'briefcase-outline',
  'car-outline',
  'home-outline',
  'shopping-outline',
];

interface WalletFormModalProps {
  visible: boolean;
  wallet?: Wallet | null;
  currency: string;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    icon: string;
    color: string;
    isDefault: boolean;
    initialBalance?: number;
  }) => Promise<void>;
}

export const WalletFormModal: React.FC<WalletFormModalProps> = ({
  visible,
  wallet,
  currency,
  onClose,
  onSave,
}) => {
  const themeColors = useThemeColors();
  const isEditing = !!wallet;

  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wallet) {
      setName(wallet.name);
      setIcon(wallet.icon || ICON_OPTIONS[0]);
      setIsDefault(wallet.isDefault || false);
      setInitialBalance('');
    } else {
      setName('');
      setIcon(ICON_OPTIONS[0]);
      setIsDefault(false);
      setInitialBalance('');
    }
    setError(null);
  }, [wallet, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Wallet name is required');
      triggerHaptic('notificationError');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const parsedBalance = parseFloat(initialBalance);
      await onSave({
        id: wallet?.id,
        name: name.trim(),
        icon,
        color: wallet?.color || themeColors.primary,
        isDefault,
        initialBalance: !isEditing && !isNaN(parsedBalance) && parsedBalance !== 0 ? parsedBalance : undefined,
      });
      triggerHaptic('notificationSuccess');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save wallet');
      triggerHaptic('notificationError');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.hairline }]}>
            <Text style={[styles.title, { color: themeColors.text }]}>
              {isEditing ? 'EDIT WALLET' : 'CREATE WALLET'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={20} color={themeColors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {error && (
              <View style={[styles.errorBox, { borderColor: themeColors.error }]}>
                <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
              </View>
            )}

            {/* Wallet Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>
                WALLET NAME
              </Text>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (error) setError(null);
                }}
                placeholder="e.g. Main Checking, Crypto, Cash"
                placeholderTextColor={themeColors.textMuted}
                style={[
                  styles.input,
                  {
                    color: themeColors.text,
                    borderColor: themeColors.hairline,
                    backgroundColor: themeColors.background,
                  },
                ]}
                autoCapitalize="words"
              />
            </View>

            {/* Starting Balance (New Wallets Only) */}
            {!isEditing && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>
                  STARTING BALANCE ({currency})
                </Text>
                <TextInput
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                  placeholder="0.00"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="decimal-pad"
                  style={[
                    styles.input,
                    {
                      color: themeColors.text,
                      borderColor: themeColors.hairline,
                      backgroundColor: themeColors.background,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                />
              </View>
            )}

            {/* Icon Picker */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>
                ICON IDENTIFIER
              </Text>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((item) => {
                  const isSelected = icon === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      activeOpacity={0.7}
                      onPress={() => {
                        triggerHaptic('selection');
                        setIcon(item);
                      }}
                      style={[
                        styles.iconOption,
                        {
                          borderColor: isSelected ? themeColors.text : themeColors.hairline,
                          backgroundColor: isSelected ? themeColors.text : themeColors.background,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item}
                        size={20}
                        color={isSelected ? themeColors.background : themeColors.text}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Default Wallet Switch */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic('selection');
                setIsDefault(!isDefault);
              }}
              style={[
                styles.defaultRow,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.background,
                },
              ]}
            >
              <View style={styles.defaultMeta}>
                <Text style={[styles.defaultTitle, { color: themeColors.text }]}>
                  Set as Default Wallet
                </Text>
                <Text style={[styles.defaultSubtitle, { color: themeColors.textMuted }]}>
                  New transactions will select this wallet by default
                </Text>
              </View>
              <MaterialCommunityIcons
                name={isDefault ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={isDefault ? themeColors.text : themeColors.textMuted}
              />
            </TouchableOpacity>
          </ScrollView>

          {/* Action Footer */}
          <View style={[styles.footer, { borderTopColor: themeColors.hairline }]}>
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              style={[
                styles.cancelButton,
                { borderColor: themeColors.hairline },
              ]}
            >
              <Text style={[styles.cancelText, { color: themeColors.textMuted }]}>
                CANCEL
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[
                styles.saveButton,
                {
                  backgroundColor: themeColors.text,
                  borderColor: themeColors.text,
                },
              ]}
            >
              <Text style={[styles.saveText, { color: themeColors.background }]}>
                {saving ? 'SAVING...' : isEditing ? 'UPDATE' : 'CREATE'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderWidth: 1,
    borderRadius: borderRadius.xs, // 2px subtle corner
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  scrollBody: {
    padding: 20,
  },
  errorBox: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 2,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderRadius: 2,
    marginBottom: 10,
  },
  defaultMeta: {
    flex: 1,
    marginRight: 10,
  },
  defaultTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  defaultSubtitle: {
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  saveButton: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
