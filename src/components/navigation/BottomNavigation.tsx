/**
 * Purpose: Fixed bottom navigation bar with 5 tabs (replaces FAB)
 *
 * Inputs:
 *   - currentRoute (string): Currently active route name
 *   - navigation (NavigationProp): React Navigation object
 *
 * Outputs:
 *   - Returns (JSX.Element): Bottom navigation bar component
 *
 * Side effects:
 *   - Navigates to respective screens when tabs are pressed
 */

import React, { useMemo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useSettingsStore } from '../../store/settingsStore';
import { MainStackParamList } from '../../types/navigation';

type NavigationProp = StackNavigationProp<MainStackParamList>;

interface TabConfig {
  id: string;
  icon: string;
  route: keyof MainStackParamList;
  isCenter?: boolean;
}

const tabs: TabConfig[] = [
  { id: 'dashboard', icon: 'view-dashboard', route: 'Dashboard' },
  { id: 'transactions', icon: 'wallet', route: 'TransactionHistory' },
  { id: 'add', icon: 'plus', route: 'AddTransaction', isCenter: true },
  { id: 'ai', icon: 'robot-outline', route: 'ChatScreen' },
  { id: 'settings', icon: 'cog', route: 'Settings' },
];

export const BottomNavigation: React.FC = React.memo(() => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleTabPress = useCallback((tab: TabConfig) => {
    if (tab.isCenter) {
      // Center button - navigate to AddTransaction
      navigation.navigate('AddTransaction', {});
      return;
    }

    if (tab.id === 'ai') {
      // Check if AI is configured
      const aiSettings = useSettingsStore.getState().aiSettings;
      if (aiSettings?.isConfigured) {
        navigation.navigate('ChatScreen');
      } else {
        Alert.alert(
          'Get Free AI Assistant',
          "Get personalized insights about your spending, goals, and more!\n\nIt's 100% FREE - no credit card needed. Setup takes less than 30 seconds.",
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Get Free Key →', onPress: () => navigation.navigate('AISettings') }
          ]
        );
      }
      return;
    }

    navigation.navigate(tab.route as any);
  }, [navigation]);

  const isActive = useCallback((tab: TabConfig) => {
    return route.name === tab.route;
  }, [route.name]);

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = isActive(tab);

        if (tab.isCenter) {
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.centerButton}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={24}
                color={themeColors.isDark ? themeColors.background : '#1f201f'}
              />
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => handleTabPress(tab)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={24}
              color={active ? themeColors.primary : themeColors.isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

BottomNavigation.displayName = 'BottomNavigation';

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    paddingTop: spacing.md,
    backgroundColor: themeColors.isDark
      ? 'rgba(31, 32, 31, 0.9)'
      : 'rgba(255, 255, 255, 0.9)',
    borderTopWidth: 1,
    borderTopColor: themeColors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: themeColors.shadow,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: themeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -32,
    shadowColor: themeColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});
