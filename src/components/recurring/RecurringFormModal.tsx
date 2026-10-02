// Simplizum Recurring Form Modal — Swift Natural Language Cadence Builder & Unified Commitment Model
import React, { useState, useEffect, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { useThemeColors } from '../../hooks/useThemeColors';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import type { RecurringTransaction, Category, Wallet, FrequencyUnit } from '../../types/models';

interface RecurringFormModalProps {
  visible: boolean;
  item?: RecurringTransaction | null;
  wallets: Wallet[];
  categories: Category[];
  currency: string;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    amount: number;
    walletId: string;
    categoryId?: string;
    frequencyUnit: FrequencyUnit;
    frequencyInterval: number;
    billingDay?: number | null;
    startDate: number;
    autoDeduct: boolean;
    reminderDaysBefore: number;
    isSubscription: boolean;
  }) => Promise<void>;
}

const CADENCE_PRESETS: Array<{
  label: string;
  unit: FrequencyUnit;
  interval: number;
}> = [
  { label: 'MONTHLY', unit: 'month', interval: 1 },
  { label: 'WEEKLY', unit: 'week', interval: 1 },
  { label: 'BI-WEEKLY', unit: 'week', interval: 2 },
  { label: 'YEARLY', unit: 'year', interval: 1 },
  { label: 'CUSTOM', unit: 'month', interval: 1 },
];

export const RecurringFormModal: React.FC<RecurringFormModalProps> = ({
  visible,
  item,
  wallets,
  categories,
  currency,
  onClose,
  onSave,
}) => {
  const themeColors = useThemeColors();
  const isEditing = !!item;

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isSubscription, setIsSubscription] = useState(true);
  const [frequencyUnit, setFrequencyUnit] = useState<FrequencyUnit>('month');
  const [frequencyInterval, setFrequencyInterval] = useState('1');
  const [billingDay, setBillingDay] = useState<string>('1');
  const [autoDeduct, setAutoDeduct] = useState(true);
  const [reminderDays, setReminderDays] = useState(1);
  const [isCustomCadence, setIsCustomCadence] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal sub-pickers
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setAmount(String(item.amount));
      setWalletId(item.walletId);
      setCategoryId(item.categoryId || '');
      setIsSubscription(item.isSubscription);
      setFrequencyUnit(item.frequencyUnit);
      setFrequencyInterval(String(item.frequencyInterval || 1));
      setBillingDay(item.billingDay ? String(item.billingDay) : '1');
      setAutoDeduct(item.autoDeduct);
      setReminderDays(item.reminderDaysBefore ?? 1);

      // Check if matches standard preset
      const isPreset = CADENCE_PRESETS.some(
        (p) => p.unit === item.frequencyUnit && p.interval === item.frequencyInterval && p.label !== 'CUSTOM'
      );
      setIsCustomCadence(!isPreset);
    } else {
      setName('');
      setAmount('');
      const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];
      setWalletId(defaultWallet ? defaultWallet.id : '');
      const defaultCategory = categories.find((c) => c.type === 'expense') || categories[0];
      setCategoryId(defaultCategory ? defaultCategory.id : '');
      setIsSubscription(true);
      setFrequencyUnit('month');
      setFrequencyInterval('1');
      setBillingDay(String(new Date().getDate()));
      setAutoDeduct(true);
      setReminderDays(1);
      setIsCustomCadence(false);
    }
    setError(null);
  }, [item, visible, wallets, categories]);

  const selectedWallet = useMemo(() => {
    return wallets.find((w) => w.id === walletId);
  }, [wallets, walletId]);

  const handlePresetSelect = (preset: typeof CADENCE_PRESETS[0]) => {
    triggerHaptic('selection');
    if (preset.label === 'CUSTOM') {
      setIsCustomCadence(true);
      return;
    }
    setIsCustomCadence(false);
    setFrequencyUnit(preset.unit);
    setFrequencyInterval(String(preset.interval));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Commitment name is required');
      triggerHaptic('notificationError');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      triggerHaptic('notificationError');
      return;
    }

    if (!walletId) {
      setError('Please select a payment wallet');
      triggerHaptic('notificationError');
      return;
    }

    const numInterval = Math.max(1, parseInt(frequencyInterval, 10) || 1);
    const parsedBillingDay = frequencyUnit === 'month' ? parseInt(billingDay, 10) || 1 : null;

    try {
      setSaving(true);
      setError(null);
      await onSave({
        id: item?.id,
        name: name.trim(),
        amount: numAmount,
        walletId,
        categoryId: categoryId || undefined,
        frequencyUnit,
        frequencyInterval: numInterval,
        billingDay: parsedBillingDay,
        startDate: item?.startDate || Date.now(),
        autoDeduct,
        reminderDaysBefore: reminderDays,
        isSubscription,
      });

      triggerHaptic('notificationSuccess');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save recurring commitment');
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
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.backdrop} />

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
              {isEditing ? 'EDIT RECURRING' : 'NEW RECURRING COMMITMENT'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={20} color={themeColors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {error && (
              <View style={[styles.errorBox, { borderColor: themeColors.error }]}>
                <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
              </View>
            )}

            {/* Commitment Kind: Subscription vs Bill */}
            <View
              style={[
                styles.kindSwitch,
                {
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.hairline,
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic('selection');
                  setIsSubscription(true);
                }}
                style={[
                  styles.kindTab,
                  isSubscription && { backgroundColor: themeColors.text },
                ]}
              >
                <Text
                  style={[
                    styles.kindTabText,
                    {
                      color: isSubscription ? themeColors.background : themeColors.text,
                    },
                  ]}
                >
                  SUBSCRIPTION
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  triggerHaptic('selection');
                  setIsSubscription(false);
                }}
                style={[
                  styles.kindTab,
                  !isSubscription && { backgroundColor: themeColors.text },
                ]}
              >
                <Text
                  style={[
                    styles.kindTabText,
                    {
                      color: !isSubscription ? themeColors.background : themeColors.text,
                    },
                  ]}
                >
                  RECURRING BILL
                </Text>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>
                COMMITMENT NAME
              </Text>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (error) setError(null);
                }}
                placeholder="e.g. Netflix, Rent, Gym, AWS"
                placeholderTextColor={themeColors.textMuted}
                style={[
                  styles.input,
                  {
                    color: themeColors.text,
                    borderColor: themeColors.hairline,
                    backgroundColor: themeColors.background,
                  },
                ]}
              />
            </View>

            {/* Amount */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>
                AMOUNT ({currency})
              </Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
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

            {/* Payment Wallet Chip */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>
                PAYMENT WALLET
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic('selection');
                  setWalletPickerOpen(true);
                }}
                style={[
                  styles.walletChip,
                  {
                    borderColor: themeColors.hairline,
                    backgroundColor: themeColors.background,
                  },
                ]}
              >
                <View style={styles.walletChipLeft}>
                  <MaterialCommunityIcons
                    name={selectedWallet?.icon || 'wallet-outline'}
                    size={16}
                    color={themeColors.text}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.walletChipText, { color: themeColors.text }]}>
                    {selectedWallet?.name || 'Select Wallet'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-down" size={16} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Cadence: Swift Natural Language Selector */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: themeColors.textMuted }]}>
                REPETITION CADENCE
              </Text>

              {/* Preset Chips */}
              <View style={styles.presetsRow}>
                {CADENCE_PRESETS.map((p) => {
                  const isSelected =
                    p.label === 'CUSTOM'
                      ? isCustomCadence
                      : !isCustomCadence &&
                        frequencyUnit === p.unit &&
                        parseInt(frequencyInterval, 10) === p.interval;

                  return (
                    <TouchableOpacity
                      key={p.label}
                      activeOpacity={0.7}
                      onPress={() => handlePresetSelect(p)}
                      style={[
                        styles.presetChip,
                        {
                          borderColor: isSelected ? themeColors.text : themeColors.hairline,
                          backgroundColor: isSelected ? themeColors.text : themeColors.background,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          {
                            color: isSelected ? themeColors.background : themeColors.text,
                          },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Interval Sentence Builder */}
              {isCustomCadence && (
                <View
                  style={[
                    styles.customSentenceBox,
                    {
                      backgroundColor: themeColors.background,
                      borderColor: themeColors.hairline,
                    },
                  ]}
                >
                  <Text style={[styles.sentenceText, { color: themeColors.text }]}>
                    Repeat every
                  </Text>

                  <TextInput
                    value={frequencyInterval}
                    onChangeText={setFrequencyInterval}
                    keyboardType="number-pad"
                    style={[
                      styles.intervalInput,
                      {
                        color: themeColors.text,
                        borderColor: themeColors.text,
                      },
                    ]}
                  />

                  {/* Unit Selector (Day | Week | Month | Year) */}
                  <View style={styles.unitPillsRow}>
                    {(['day', 'week', 'month', 'year'] as FrequencyUnit[]).map((u) => {
                      const isSel = frequencyUnit === u;
                      return (
                        <TouchableOpacity
                          key={u}
                          onPress={() => {
                            triggerHaptic('selection');
                            setFrequencyUnit(u);
                          }}
                          style={[
                            styles.unitPill,
                            {
                              borderColor: isSel ? themeColors.text : themeColors.hairline,
                              backgroundColor: isSel ? themeColors.text : 'transparent',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.unitPillText,
                              {
                                color: isSel ? themeColors.background : themeColors.text,
                              },
                            ]}
                          >
                            {u.toUpperCase()}S
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* Auto-Deduct Toggle */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                triggerHaptic('selection');
                setAutoDeduct(!autoDeduct);
              }}
              style={[
                styles.toggleCard,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.background,
                },
              ]}
            >
              <View style={styles.toggleMeta}>
                <Text style={[styles.toggleTitle, { color: themeColors.text }]}>
                  Auto-Deduct on Due Date
                </Text>
                <Text style={[styles.toggleSub, { color: themeColors.textMuted }]}>
                  Automatically record transaction in wallet when payment is due
                </Text>
              </View>
              <MaterialCommunityIcons
                name={autoDeduct ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={autoDeduct ? themeColors.text : themeColors.textMuted}
              />
            </TouchableOpacity>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: themeColors.hairline }]}>
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              style={[styles.cancelBtn, { borderColor: themeColors.hairline }]}
            >
              <Text style={[styles.cancelBtnText, { color: themeColors.textMuted }]}>
                CANCEL
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: themeColors.text,
                  borderColor: themeColors.text,
                },
              ]}
            >
              <Text style={[styles.saveBtnText, { color: themeColors.background }]}>
                {saving ? 'SAVING...' : isEditing ? 'UPDATE' : 'SAVE COMMITMENT'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Wallet Selector Sub-Modal */}
      <Modal
        visible={walletPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWalletPickerOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setWalletPickerOpen(false)}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.cardBorder,
              },
            ]}
          >
            <View style={[styles.sheetHeader, { borderBottomColor: themeColors.hairline }]}>
              <Text style={[styles.sheetTitle, { color: themeColors.text }]}>
                SELECT WALLET
              </Text>
              <TouchableOpacity onPress={() => setWalletPickerOpen(false)}>
                <MaterialCommunityIcons name="close" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 280 }}>
              {wallets.map((w) => {
                const isSelected = walletId === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerHaptic('selection');
                      setWalletId(w.id);
                      setWalletPickerOpen(false);
                    }}
                    style={[styles.pickerOption, { borderBottomColor: themeColors.hairline }]}
                  >
                    <View style={styles.pickerOptionLeft}>
                      <MaterialCommunityIcons
                        name={w.icon || 'wallet-outline'}
                        size={16}
                        color={themeColors.text}
                        style={{ marginRight: 10 }}
                      />
                      <Text style={[styles.pickerOptionName, { color: themeColors.text }]}>
                        {w.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={18} color={themeColors.text} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scrollBody: {
    padding: 18,
  },
  errorBox: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 2,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  kindSwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 2,
    padding: 3,
    marginBottom: 16,
  },
  kindTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  kindTabText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 42,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 12,
  },
  walletChipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 2,
  },
  presetChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  customSentenceBox: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 12,
    marginTop: 10,
  },
  sentenceText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  intervalInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderRadius: 2,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  unitPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  unitPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 2,
  },
  unitPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderRadius: 2,
    marginBottom: 8,
  },
  toggleMeta: {
    flex: 1,
    marginRight: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  saveBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pickerOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerOptionName: {
    fontSize: 14,
    fontWeight: '600',
  },
});
