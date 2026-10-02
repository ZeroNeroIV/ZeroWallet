// Simplizum Command Header — Top bar with hairline border and micro-actions
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { useThemeColors } from '../../hooks/useThemeColors';
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
  const todayStr = format(new Date(), 'MMMM d').toUpperCase();

  const handlePress = (callback: () => void) => {
    triggerHaptic('impactLight');
    callback();
  };

  return (
    <View style={[styles.headerContainer, { borderBottomColor: themeColors.hairline, backgroundColor: themeColors.background }]}>
      <View style={styles.titleSection}>
        <Text style={[styles.dateMicroCaps, { color: themeColors.textMuted }]}>
          {todayStr}
        </Text>
        <Text style={[styles.brandTitle, { color: themeColors.text }]}>
          ZERO WALLET
        </Text>
      </View>

      <View style={styles.actionGroup}>
        <TouchableOpacity
          style={[styles.iconButton, { borderColor: themeColors.hairline }]}
          onPress={() => handlePress(onSearchPress)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="magnify" size={18} color={themeColors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { borderColor: themeColors.hairline }]}
          onPress={() => handlePress(onAIPress)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="creation" size={17} color={themeColors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, { borderColor: themeColors.hairline }]}
          onPress={() => handlePress(onLockPress)}
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
    justifyContent: 'center',
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
