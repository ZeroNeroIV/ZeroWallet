// Simplizum Command Header — Top bar with hairline border and micro-actions
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useUIStore } from '../../store/uiStore';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';

interface SimplizumHeaderProps {
  onSearchPress: () => void;
  onAIPress: () => void;
  onLockPress: () => void;
}

export const SimplizumHeader: React.FC<SimplizumHeaderProps> = ({
  onSearchPress,
  onAIPress,
  onLockPress,
}) => {
  const themeColors = useThemeColors();
  const isBalanceHidden = useUIStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useUIStore((s) => s.toggleBalanceHidden);
  const todayStr = format(new Date(), 'MMMM d').toUpperCase();

  const handlePress = (callback: () => void) => {
    triggerHaptic('impactLight');
    callback();
  };

  return (
    <View style={[styles.headerContainer, { borderBottomColor: themeColors.hairline, backgroundColor: themeColors.background }]}>
      <View style={styles.titleSection}>
        <Text style={[styles.dateMicroCaps, { color: themeColors.textMuted }]} numberOfLines={1}>
          {todayStr}
        </Text>
        <Text style={[styles.brandTitle, { color: themeColors.text }]} numberOfLines={1}>
          ZERO WALLET
        </Text>
      </View>

      <View style={styles.actionGroup}>
        <TouchableOpacity
          style={[styles.iconButton, { borderColor: themeColors.hairline }]}
          onPress={() => {
            triggerHaptic('selection');
            toggleBalanceHidden();
          }}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityLabel="Toggle Balance Visibility"
        >
          <MaterialCommunityIcons
            name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={themeColors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { borderColor: themeColors.hairline }]}
          onPress={() => handlePress(onSearchPress)}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="magnify" size={18} color={themeColors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { borderColor: themeColors.hairline }]}
          onPress={() => handlePress(onAIPress)}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="creation" size={17} color={themeColors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { borderColor: themeColors.hairline }]}
          onPress={() => handlePress(onLockPress)}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="shield-lock-outline" size={17} color={themeColors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  titleSection: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 10,
  },
  dateMicroCaps: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
