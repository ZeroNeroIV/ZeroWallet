/**
 * Purpose: Bottom action sheet for the + button — Expense, Income, Transfer
 *
 * Inputs:
 *   - visible (boolean): Show or hide the sheet
 *   - onClose (function): Called when dismissed
 *   - onSelect (function): Called with 'expense' | 'income' | 'transfer'
 *
 * Outputs:
 *   - Returns (JSX.Element): Action sheet modal
 *
 * Side effects: None
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic } from '../../services/haptics/hapticFeedback';

export type QuickAddAction = 'expense' | 'income' | 'transfer';

interface QuickAddSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: QuickAddAction) => void;
}

export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({
  visible,
  onClose,
  onSelect,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleSelect = (action: QuickAddAction) => {
    lightHaptic();
    onSelect(action);
  };

  const renderOption = (
    action: QuickAddAction,
    icon: string,
    label: string,
    hint: string,
    iconColor: string,
  ) => (
    <TouchableOpacity
      style={styles.option}
      onPress={() => handleSelect(action)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${iconColor}20` }]}>
        <MaterialCommunityIcons name={icon as any} size={24} color={iconColor} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionHint}>{hint}</Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={themeColors.textSecondary}
      />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <Text style={styles.title}>What do you want to add?</Text>
              {renderOption('expense', 'arrow-top-right', 'Expense', 'Log money you spent', themeColors.error)}
              {renderOption('income', 'arrow-bottom-left', 'Income', 'Log money you received', themeColors.success)}
              {renderOption('transfer', 'bank-transfer', 'Transfer', 'Move money between wallets', themeColors.primary)}
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: themeColors.border,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.h3,
      color: themeColors.text,
      marginBottom: spacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.background,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      gap: spacing.md,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionText: {
      flex: 1,
    },
    optionLabel: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
    },
    optionHint: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
    },
    cancelText: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
  });
