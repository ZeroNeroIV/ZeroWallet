import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  BackHandler,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
  const scrollViewRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const themeColors = useThemeColors();

  const activeTabIndex = useNavigationTabStore((s) => s.activeTabIndex);
  const targetScrollIndex = useNavigationTabStore((s) => s.targetScrollIndex);
  const clearScrollTarget = useNavigationTabStore((s) => s.clearScrollTarget);
  const setActiveTabIndex = useNavigationTabStore((s) => s.setActiveTabIndex);

  // Instant horizontal scroll when a tab or programmatic trigger requests scrollToTab
  useEffect(() => {
    if (targetScrollIndex !== null && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: targetScrollIndex * screenWidth,
        animated: false,
      });
      clearScrollTarget();
    }
  }, [targetScrollIndex, screenWidth, clearScrollTarget]);

  // Sync active tab indicator when user finishes a manual horizontal swipe (if programmatic)
  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / screenWidth);
      if (pageIndex >= 0 && pageIndex <= 3 && pageIndex !== activeTabIndex) {
        setActiveTabIndex(pageIndex);
      }
    },
    [screenWidth, activeTabIndex, setActiveTabIndex]
  );

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
      <ScrollView
        ref={scrollViewRef}
        horizontal
        scrollEnabled={false}
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.horizontalScrollContent}
      >
        <View style={[styles.page, { width: screenWidth }]}>
          <DashboardScreen />
        </View>
        <View style={[styles.page, { width: screenWidth }]}>
          <TransactionHistoryScreen />
        </View>
        <View style={[styles.page, { width: screenWidth }]}>
          <RecurringHubScreen />
        </View>
        <View style={[styles.page, { width: screenWidth }]}>
          <SettingsScreen navigation={navigation} />
        </View>
      </ScrollView>

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
    horizontalScroll: {
      flex: 1,
    },
    horizontalScrollContent: {
      flexGrow: 1,
    },
    page: {
      flex: 1,
    },
  });
