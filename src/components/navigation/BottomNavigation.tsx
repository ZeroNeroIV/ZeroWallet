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
import { QuickAddSheet, type QuickAddAction } from './QuickAddSheet';
import { MainStackParamList } from '../../types/navigation';

type NavigationProp = StackNavigationProp<MainStackParamList>;

interface TabConfig {
  id: string;
  icon: string;
  route: keyof MainStackParamList;
  isCenter?: boolean;
}

const tabs: TabConfig[] = [
  { id: 'dashboard', icon: 'view-dashboard-outline', route: 'Dashboard' },
  { id: 'wallets', icon: 'wallet-outline', route: 'Wallets' },
  { id: 'add', icon: 'plus', route: 'AddTransaction', isCenter: true },
  { id: 'recurring', icon: 'calendar-clock-outline', route: 'Recurring' },
  { id: 'settings', icon: 'cog-outline', route: 'Settings' },
];

export const BottomNavigation: React.FC = React.memo(() => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [showQuickAdd, setShowQuickAdd] = React.useState(false);

  const handleQuickAdd = useCallback((action: QuickAddAction) => {
    setShowQuickAdd(false);
    if (action === 'expense') {
      navigation.navigate('AddTransaction', { type: 'expense' });
    } else if (action === 'income') {
      navigation.navigate('AddTransaction', { type: 'income' });
    } else {
      navigation.navigate('Transfer');
    }
  }, [navigation]);

  const handleTabPress = useCallback((tab: TabConfig) => {
    if (tab.isCenter) {
      setShowQuickAdd(true);
      return;
    }

    navigation.navigate(tab.route as any);
  }, [navigation]);

  const isActive = useCallback((tab: TabConfig) => {
    return route.name === tab.route;
  }, [route.name]);

  return (
    <View style={styles.container}>
      <QuickAddSheet
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSelect={handleQuickAdd}
      />
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
                size={20}
                color={themeColors.onPrimary}
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
              size={22}
              color={active ? themeColors.primary : themeColors.textMuted}
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
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 20,
    right: 20,
    height: 54,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: themeColors.hairline,
    backgroundColor: themeColors.railBackground,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  centerButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: themeColors.primary,
    backgroundColor: themeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
