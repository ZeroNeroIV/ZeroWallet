import React, { useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  BackHandler,
} from 'react-native';
import { DashboardScreen } from '../dashboard/DashboardScreen';
import { TransactionHistoryScreen } from '../transactions/TransactionHistoryScreen';
import RecurringHubScreen from '../recurring/RecurringHubScreen';
import SettingsScreen from '../settings/SettingsScreen';
import { BottomNavigation } from '../../components/navigation/BottomNavigation';
import { useNavigationTabStore } from '../../store/navigationTabStore';
import { useThemeColors } from '../../hooks/useThemeColors';

interface MainTabScreenProps {
  navigation: any;
  route: any;
}

export const MainTabScreen: React.FC<MainTabScreenProps> = ({ navigation }) => {
  const themeColors = useThemeColors();
  const activeTabIndex = useNavigationTabStore((s) => s.activeTabIndex);

  // Android hardware back button: returns to Dashboard (tab 0) ONLY if on a secondary tab AND screen is focused
  useEffect(() => {
    const onBackPress = () => {
      if (!navigation.isFocused()) {
        return false;
      }
      const currentTab = useNavigationTabStore.getState().activeTabIndex;
      if (currentTab !== 0) {
        useNavigationTabStore.getState().scrollToTab(0);
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View style={styles.root}>
      <View style={styles.page}>
        {activeTabIndex === 0 && <DashboardScreen />}
        {activeTabIndex === 1 && <TransactionHistoryScreen />}
        {activeTabIndex === 2 && <RecurringHubScreen />}
        {activeTabIndex === 3 && <SettingsScreen navigation={navigation} />}
      </View>

      {/* Persistent, stationary floating bottom bar */}
      <BottomNavigation />
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    page: {
      flex: 1,
    },
  });
