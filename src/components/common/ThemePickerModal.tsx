/**
 * Purpose: Modal for selecting app theme (light/dark/system)
 * 
 * Inputs:
 *   - visible (boolean): Whether modal is visible
 *   - currentTheme (ThemeMode): Currently selected theme
 *   - onSelect (function): Callback when theme is selected
 *   - onClose (function): Callback to close modal
 * 
 * Outputs:
 *   - Returns (JSX.Element): Theme picker modal component
 * 
 * Side effects:
 *   - Triggers haptic feedback on selection
 *   - Calls onSelect callback with selected theme
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { ThemeMode } from '../../contexts/ThemeContext';
import { useThemeColors } from '../../hooks/useThemeColors';

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: string;
  description: string;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    icon: 'white-balance-sunny',
    description: 'Always use light mode',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: 'moon-waning-crescent',
    description: 'Always use dark mode',
  },
  {
    value: 'system',
    label: 'System',
    icon: 'cellphone',
    description: 'Follow system settings',
  },
];

interface ThemePickerModalProps {
  visible: boolean;
  currentTheme: ThemeMode;
  onSelect: (theme: ThemeMode) => void;
  onClose: () => void;
}

export const ThemePickerModal: React.FC<ThemePickerModalProps> = ({
  visible,
  currentTheme,
  onSelect,
  onClose,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleSelect = (theme: ThemeMode) => {
    mediumHaptic();
    onSelect(theme);
    setTimeout(onClose, 200);
  };

  const handleBackdropPress = () => {
    lightHaptic();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Theme</Text>
            <TouchableOpacity onPress={handleBackdropPress} hitSlop={10}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsContainer}>
            {themeOptions.map((option) => {
              const isSelected = option.value === currentTheme;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                  onPress={() => handleSelect(option.value)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      isSelected && styles.iconContainerSelected,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon as any}
                      size={28}
                      color={isSelected ? colors.primary.main : themeColors.textSecondary}
                    />
                  </View>
                  
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>

                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={colors.primary.main}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalContent: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      padding: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.h3,
      color: themeColors.text,
    },
    optionsContainer: {
      gap: spacing.sm,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: themeColors.border,
      backgroundColor: themeColors.background,
    },
    optionCardSelected: {
      borderColor: colors.primary.main,
      backgroundColor: colors.primary.light + '20',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: themeColors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    iconContainerSelected: {
      backgroundColor: colors.primary.light,
    },
    optionInfo: {
      flex: 1,
    },
    optionLabel: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 2,
    },
    optionLabelSelected: {
      color: colors.primary.main,
    },
    optionDescription: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
  });
