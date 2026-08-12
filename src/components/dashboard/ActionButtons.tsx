/**
 * Purpose: Send and Receive action buttons for quick transaction access
 *
 * Inputs:
 *   - navigation (NavigationProp): React Navigation object for screen navigation
 *
 * Outputs:
 *   - Returns (JSX.Element): Action buttons component
 *
 * Side effects:
 *   - Navigates to AddTransaction screen with preset type (expense for Send, income for Receive)
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { MainStackParamList } from '../../types/navigation';

type NavigationProp = StackNavigationProp<MainStackParamList>;

export const ActionButtons: React.FC = React.memo(() => {
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleSendPress = useCallback(() => {
    navigation.navigate('AddTransaction', { type: 'expense' });
  }, [navigation]);

  const handleReceivePress = useCallback(() => {
    navigation.navigate('AddTransaction', { type: 'income' });
  }, [navigation]);

  const handleTransferPress = useCallback(() => {
    navigation.navigate('Transfer');
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Send Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleSendPress}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="arrow-top-right"
          size={20}
          color={themeColors.primary}
        />
        <Text style={styles.buttonText}>SEND</Text>
      </TouchableOpacity>

      {/* Receive Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleReceivePress}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="arrow-bottom-left"
          size={20}
          color={themeColors.primary}
        />
        <Text style={styles.buttonText}>RECEIVE</Text>
      </TouchableOpacity>

      {/* Transfer Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleTransferPress}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="bank-transfer"
          size={20}
          color={themeColors.primary}
        />
        <Text style={styles.buttonText}>TRANSFER</Text>
      </TouchableOpacity>
    </View>
  );
});

ActionButtons.displayName = 'ActionButtons';

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  button: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: themeColors.glass.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themeColors.glass.borderLight,
  },
  buttonText: {
    ...typography.button,
    fontSize: 13,
    fontWeight: '700',
    color: themeColors.text,
    letterSpacing: 1,
  },
});
