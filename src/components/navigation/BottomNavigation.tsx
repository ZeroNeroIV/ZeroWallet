/**
 * Purpose: Persistent bottom navigation rail with 5 tabs across primary hubs
 *
 * Inputs:
 *   - None (reads active tab from navigationTabStore)
 *
 * Outputs:
 *   - Returns (JSX.Element): Bottom navigation bar component
 *
 * Side effects:
 *   - Smoothly scrolls to respective horizontal tab pages or opens QuickAdd modal
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { QuickAddSheet, type QuickAddAction } from './QuickAddSheet';
import { MainStackParamList } from '../../types/navigation';
import { useNavigationTabStore } from '../../store/navigationTabStore';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';

type NavigationProp = StackNavigationProp<MainStackParamList>;

interface TabConfig {
  id: string;
  icon: string;
  pageIndex?: number;
  isCenter?: boolean;
}

const tabs: TabConfig[] = [
  { id: 'dashboard', icon: 'view-dashboard-outline', pageIndex: 0 },
  { id: 'wallets', icon: 'wallet-outline', pageIndex: 1 },
  { id: 'add', icon: 'plus', isCenter: true },
  { id: 'recurring', icon: 'calendar-clock-outline', pageIndex: 2 },
  { id: 'settings', icon: 'cog-outline', pageIndex: 3 },
];

export const BottomNavigation: React.FC = React.memo(() => {
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const activeTabIndex = useNavigationTabStore((s) => s.activeTabIndex);

  const handleQuickAdd = useCallback(
    (action: QuickAddAction) => {
      setShowQuickAdd(false);
      if (action === 'expense') {
        navigation.navigate('AddTransaction', { type: 'expense' });
      } else if (action === 'income') {
        navigation.navigate('AddTransaction', { type: 'income' });
      } else {
        navigation.navigate('Transfer');
      }
    },
    [navigation]
  );

  const handleTabPress = useCallback((tab: TabConfig) => {
    if (tab.isCenter) {
      triggerHaptic('selection');
      setShowQuickAdd(true);
      return;
    }

    if (tab.pageIndex !== undefined) {
      triggerHaptic('selection');
      useNavigationTabStore.getState().scrollToTab(tab.pageIndex);
    }
  }, []);

  return (
    <View style={styles.container}>
      <QuickAddSheet
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSelect={handleQuickAdd}
      />
      {tabs.map((tab) => {
        const active = !tab.isCenter && tab.pageIndex === activeTabIndex;

        if (tab.isCenter) {
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.centerButton}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.8}
              accessibilityLabel="Quick Add Transaction or Transfer"
              accessibilityRole="button"
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
            accessibilityLabel={`${tab.id} tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
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

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
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
