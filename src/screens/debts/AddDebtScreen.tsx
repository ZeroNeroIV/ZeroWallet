/**
 * Purpose: Full-screen Simplizum Add/Edit Debt Screen.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { getCurrencySymbol } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { DebtRepository } from '../../database/repositories/DebtRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import type { DebtType } from '../../types/models';

type NavigationProp = StackNavigationProp<MainStackParamList, 'AddDebt'>;
type ScreenRouteProp = RouteProp<MainStackParamList, 'AddDebt'>;

export default function AddDebtScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId) || useAccountStore((s) => s.currentAccountId);

  const routeParams = (route.params as any) || {};
  const debtId = routeParams.debtId;
  const isEditMode = Boolean(debtId);
  const initialType: DebtType = routeParams.type || 'borrowed';

  const [type, setType] = useState<DebtType>(initialType);
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDaysOffset, setDueDaysOffset] = useState<number>(30); // default 30 days
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  useEffect(() => {
    loadAccountCurrency();
    if (debtId) {
      loadDebt(debtId);
    }
  }, [debtId]);

  const loadAccountCurrency = async () => {
    if (!currentAccountId) return;
    try {
      const accRepo = new AccountRepository();
      const acc = await accRepo.findById(currentAccountId);
      if (acc?.currency) setCurrency(acc.currency);
    } catch (err) {
      console.warn('[AddDebt] Could not load currency:', err);
    }
  };

  const loadDebt = async (id: string) => {
    try {
      const debtRepo = new DebtRepository();
      const d = await debtRepo.findById(id);
      if (d) {
        setType(d.type);
        setPersonName(d.personName);
        setAmount(d.amount.toString());
        setDescription(d.description || '');
        if (d.dueDate) {
          const diffDays = Math.round((d.dueDate - Date.now()) / (1000 * 60 * 60 * 24));
          setDueDaysOffset(diffDays > 0 ? diffDays : 0);
        }
      }
    } catch (err) {
      console.error('[AddDebt] Failed to load debt:', err);
    }
  };

  const handleSave = async () => {
    if (!currentAccountId) return;
    if (!personName.trim()) {
      Alert.alert('Required', 'Please enter the counterparty name');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid loan amount greater than 0');
      return;
    }

    const dueDateTimestamp = Date.now() + dueDaysOffset * 24 * 60 * 60 * 1000;

    try {
      setSaving(true);
      triggerHaptic('notificationSuccess');
      const debtRepo = new DebtRepository();

      if (isEditMode && debtId) {
        await debtRepo.update(debtId, {
          type,
          personName: personName.trim(),
          amount: parsedAmount,
          dueDate: dueDateTimestamp,
          description: description.trim(),
        });
      } else {
        await debtRepo.create({
          accountId: currentAccountId,
          type,
          personName: personName.trim(),
          amount: parsedAmount,
          amountPaid: 0,
          dueDate: dueDateTimestamp,
          description: description.trim(),
        });
      }

      navigation.goBack();
    } catch (err: any) {
      console.error('[AddDebt] Save failed:', err);
      Alert.alert('Error', err?.message || 'Failed to save debt record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!debtId) return;
    Alert.alert(
      'Delete Record',
      `Are you sure you want to delete this debt record for "${personName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('notificationWarning');
              const debtRepo = new DebtRepository();
              await debtRepo.delete(debtId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete debt');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={themeColors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
      />

      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: themeColors.borderSubtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerNavButton, { borderColor: themeColors.borderSubtle }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" size={18} color={themeColors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerSubtitle, { color: themeColors.textMuted }]}>
            {isEditMode ? 'MODIFY OBLIGATION' : 'NEW LIABILITY RECORD'}
          </Text>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            {isEditMode ? 'Edit Debt Record' : 'Record Debt or Loan'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveHeaderButton, { backgroundColor: themeColors.text }]}
        >
          <Text style={[styles.saveHeaderText, { color: themeColors.background }]}>
            {saving ? '...' : 'SAVE'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Debt Type Selector */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            RECORD TYPE
          </Text>
          <View
            style={[
              styles.segmentContainer,
              {
                borderColor: themeColors.border,
                backgroundColor: themeColors.surfaceElevated,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.segmentButton,
                type === 'borrowed' && [
                  styles.segmentButtonActive,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ],
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setType('borrowed');
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color:
                      type === 'borrowed' ? themeColors.text : themeColors.textMuted,
                    fontWeight:
                      type === 'borrowed'
                        ? typography.weights.bold
                        : typography.weights.medium,
                  },
                ]}
              >
                I BORROWED (I OWE)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentButton,
                type === 'lent' && [
                  styles.segmentButtonActive,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ],
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setType('lent');
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color:
                      type === 'lent' ? themeColors.text : themeColors.textMuted,
                    fontWeight:
                      type === 'lent'
                        ? typography.weights.bold
                        : typography.weights.medium,
                  },
                ]}
              >
                I LENT (OWED TO ME)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Counterparty Name */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            {type === 'borrowed' ? 'LENDER / CREDITOR NAME' : 'BORROWER / RECIPIENT NAME'}
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                color: themeColors.text,
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              },
            ]}
            placeholder="e.g. John Doe, Bank of America, Sarah"
            placeholderTextColor={themeColors.textMuted}
            value={personName}
            onChangeText={setPersonName}
            autoCapitalize="words"
          />
        </View>

        {/* Amount */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            PRINCIPAL AMOUNT ({currency})
          </Text>
          <View
            style={[
              styles.amountInputRow,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text style={[styles.currencyPrefix, { color: themeColors.textMuted }]}>
              {currencySymbol}
            </Text>
            <TextInput
              style={[styles.amountInput, { color: themeColors.text }]}
              placeholder="0.00"
              placeholderTextColor={themeColors.textMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        {/* Due Date Offset Chips */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            DUE DATE HORIZON
          </Text>
          <View style={styles.chipsRow}>
            {[
              { label: '7 DAYS', days: 7 },
              { label: '14 DAYS', days: 14 },
              { label: '30 DAYS', days: 30 },
              { label: '60 DAYS', days: 60 },
              { label: '90 DAYS', days: 90 },
            ].map((chip) => {
              const isSelected = dueDaysOffset === chip.days;
              return (
                <TouchableOpacity
                  key={chip.days}
                  style={[
                    styles.chipItem,
                    {
                      borderColor: isSelected ? themeColors.text : themeColors.borderSubtle,
                      backgroundColor: isSelected
                        ? themeColors.surfaceElevated
                        : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setDueDaysOffset(chip.days);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: isSelected ? themeColors.text : themeColors.textSecondary,
                        fontWeight: isSelected
                          ? typography.weights.bold
                          : typography.weights.medium,
                      },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes / Description */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            OPTIONAL MEMO / NOTES
          </Text>
          <TextInput
            style={[
              styles.notesInput,
              {
                color: themeColors.text,
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              },
            ]}
            placeholder="e.g. Loan for laptop purchase, split trip expenses..."
            placeholderTextColor={themeColors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline={true}
            numberOfLines={3}
          />
        </View>

        {/* Delete Record */}
        {isEditMode && (
          <TouchableOpacity
            style={[
              styles.deleteButton,
              { borderColor: themeColors.error, backgroundColor: `${themeColors.error}10` },
            ]}
            onPress={handleDelete}
          >
            <Icon name="trash-can-outline" size={16} color={themeColors.error} />
            <Text style={[styles.deleteButtonText, { color: themeColors.error }]}>
              DELETE DEBT RECORD
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Floating Save Button */}
      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={[styles.floatingButton, { backgroundColor: themeColors.text }]}
      >
        <Text style={[styles.saveHeaderText, { color: themeColors.background }]}>
          {saving ? '...' : 'SAVE'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerNavButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  saveHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.xs,
  },
  saveHeaderText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  sectionBlock: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.xs,
  },
  segmentButtonActive: {
    borderWidth: 1,
  },
  segmentText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  chipText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 64,
  },
  deleteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    marginTop: spacing.md,
  },
  deleteButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  floatingButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: Platform.OS === 'ios' ? 24 : 16,
    height: 52,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
