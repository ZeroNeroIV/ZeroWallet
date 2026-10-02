/**
 * Purpose: Full-screen Simplizum Goal creation and editing screen.
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
import { GoalRepository } from '../../database/repositories/GoalRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';

type NavigationProp = StackNavigationProp<MainStackParamList, 'CreateGoal'>;
type ScreenRouteProp = RouteProp<MainStackParamList, 'CreateGoal'>;

const GOAL_ICONS = [
  '🎯', '💰', '🏠', '🚗', '✈️', '🎓', '💍', '🎮',
  '💻', '🏖️', '🛡️', '💎', '🚲', '🎁', '🏆', '🌟',
];

const ARCHITECTURAL_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
];

export default function CreateGoalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId) || useAccountStore((s) => s.currentAccountId);

  const routeParams = (route.params as any) || {};
  const goalId = routeParams.goalId;
  const isEditMode = Boolean(goalId);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(GOAL_ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(ARCHITECTURAL_COLORS[3]);
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  useEffect(() => {
    loadAccountCurrency();
    if (goalId) {
      loadGoal(goalId);
    }
  }, [goalId]);

  const loadAccountCurrency = async () => {
    if (!currentAccountId) return;
    try {
      const accRepo = new AccountRepository();
      const acc = await accRepo.findById(currentAccountId);
      if (acc?.currency) setCurrency(acc.currency);
    } catch (err) {
      console.warn('[CreateGoal] Could not load account currency:', err);
    }
  };

  const loadGoal = async (id: string) => {
    try {
      const goalRepo = new GoalRepository();
      const g = await goalRepo.findById(id);
      if (g) {
        setName(g.name);
        setTargetAmount(g.targetAmount ? g.targetAmount.toString() : '');
        setSelectedIcon(g.icon || GOAL_ICONS[0]);
        setSelectedColor(g.color || ARCHITECTURAL_COLORS[0]);
      }
    } catch (err) {
      console.error('[CreateGoal] Failed to load goal:', err);
    }
  };

  const handleSave = async () => {
    if (!currentAccountId) return;
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a goal name');
      return;
    }

    const parsedTarget = targetAmount.trim() ? parseFloat(targetAmount) : null;
    if (parsedTarget !== null && (isNaN(parsedTarget) || parsedTarget <= 0)) {
      Alert.alert('Invalid Target', 'Please enter a target amount greater than 0');
      return;
    }

    try {
      setSaving(true);
      triggerHaptic('notificationSuccess');
      const goalRepo = new GoalRepository();

      if (isEditMode && goalId) {
        await goalRepo.update(goalId, {
          name: name.trim(),
          targetAmount: parsedTarget,
          icon: selectedIcon,
          color: selectedColor,
        });
      } else {
        await goalRepo.create({
          accountId: currentAccountId,
          name: name.trim(),
          targetAmount: parsedTarget,
          currentAmount: 0,
          fundingSource: 'main',
          icon: selectedIcon,
          color: selectedColor,
        });
      }

      navigation.goBack();
    } catch (err: any) {
      console.error('[CreateGoal] Save failed:', err);
      Alert.alert('Error', err?.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!goalId) return;
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('notificationWarning');
              const goalRepo = new GoalRepository();
              await goalRepo.delete(goalId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete goal');
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
            {isEditMode ? 'TARGET RECONFIGURATION' : 'SAVINGS INITIATIVE'}
          </Text>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            {isEditMode ? 'Edit Target' : 'Create Goal'}
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
        {/* Goal Name */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            TARGET NAME
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
            placeholder="e.g. Vacation Fund, Down Payment, New Laptop"
            placeholderTextColor={themeColors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Target Amount */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            TARGET AMOUNT ({currency})
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
              value={targetAmount}
              onChangeText={setTargetAmount}
            />
          </View>
        </View>

        {/* Symbol Selection */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            SELECT SYMBOL
          </Text>
          <View style={styles.iconGrid}>
            {GOAL_ICONS.map((ic) => {
              const isSelected = ic === selectedIcon;
              return (
                <TouchableOpacity
                  key={ic}
                  style={[
                    styles.iconItem,
                    {
                      borderColor: isSelected ? themeColors.text : themeColors.borderSubtle,
                      backgroundColor: isSelected
                        ? themeColors.surfaceElevated
                        : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedIcon(ic);
                  }}
                >
                  <Text style={styles.emojiText}>{ic}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Architectural Palette */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
            ARCHITECTURAL ACCENT COLOR
          </Text>
          <View style={styles.colorRow}>
            {ARCHITECTURAL_COLORS.map((c) => {
              const isSelected = c === selectedColor;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: c,
                      borderColor: isSelected ? themeColors.text : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedColor(c);
                  }}
                >
                  {isSelected && <Icon name="check" size={12} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Delete Option */}
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
              DELETE TARGET
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconItem: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 18,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.xs,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
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
});
