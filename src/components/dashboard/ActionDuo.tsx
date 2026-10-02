// Simplizum Action Duo — The two dominant actions side-by-side
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';

interface ActionDuoProps {
  onLogTransaction: () => void;
  onTransfer: () => void;
}

export const ActionDuo: React.FC<ActionDuoProps> = ({
  onLogTransaction,
  onTransfer,
}) => {
  const themeColors = useThemeColors();

  return (
    <View style={styles.container}>
      {/* Primary: Log Transaction */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            backgroundColor: themeColors.primary,
            borderColor: themeColors.primary,
          },
        ]}
        onPress={() => {
          triggerHaptic('impactMedium');
          onLogTransaction();
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name="plus"
          size={16}
          color={themeColors.onPrimary}
          style={styles.icon}
        />
        <Text style={[styles.buttonLabel, { color: themeColors.onPrimary }]}>
          LOG TRANSACTION
        </Text>
      </TouchableOpacity>

      {/* Secondary: Direct Transfer */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            backgroundColor: themeColors.card,
            borderColor: themeColors.hairline,
          },
        ]}
        onPress={() => {
          triggerHaptic('impactLight');
          onTransfer();
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name="swap-horizontal"
          size={16}
          color={themeColors.text}
          style={styles.icon}
        />
        <Text style={[styles.buttonLabel, { color: themeColors.text }]}>
          TRANSFER
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
    marginVertical: 14,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 6,
  },
  buttonLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
});
