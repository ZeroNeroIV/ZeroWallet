import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { spacing } from '../../theme/spacing';
import { MainStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { DashboardService, type DashboardData } from '../../services/dashboardService';

import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { GradientBalanceCard } from '../../components/dashboard/GradientBalanceCard';
import { ActionButtons } from '../../components/dashboard/ActionButtons';
import { WealthAnalyticsCard } from '../../components/dashboard/WealthAnalyticsCard';
import { MovementsList } from '../../components/dashboard/MovementsList';
import { BottomNavigation } from '../../components/navigation/BottomNavigation';
import { DashboardCardsGrid } from '../../components/dashboard/DashboardCardsGrid';
import { IncomeExpenseChart } from '../../components/dashboard/IncomeExpenseChart';
import { SpendingDonutChart } from '../../components/dashboard/SpendingDonutChart';
import { GoalsProgressCard } from '../../components/dashboard/GoalsProgressCard';

type NavProp = StackNavigationProp<MainStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId);
  const { balances } = useAccountStore();
  const aiSettings = useSettingsStore((s) => s.aiSettings) || { isConfigured: false };
  const themeColors = useThemeColors();

  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<'income' | 'expense' | 'combined'>('combined');

  const fadeAnim = useState(() => new Animated.Value(1))[0];
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    if (!currentAccountId || !currentUser) return;
    const unsubscribe = navigation.addListener('focus', () => {
      fadeAnim.setValue(0.3);
      loadData();
      checkTasks();
    });
    return unsubscribe;
  }, [navigation, currentAccountId, currentUser]);

  const getService = useCallback(() => {
    if (!currentAccountId || !currentUser) return null;
    return new DashboardService(currentAccountId, currentUser.id);
  }, [currentAccountId, currentUser]);

  const loadData = async () => {
    const svc = getService();
    if (!svc) return;
    const result = await svc.loadAll();
    setData(result);
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 200, useNativeDriver: true,
    }).start();
  };

  const checkTasks = async () => {
    const svc = getService();
    if (!svc) return;
    const notifications = await svc.checkBackgroundTasks();
    if (notifications.length > 0) {
      Alert.alert('🔔 Updates', notifications.join('\n\n'), [{ text: 'OK' }]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - lastScrollY.current;
    if (diff > 5 && currentScrollY > 50) {
      Animated.timing(headerTranslateY, { toValue: -100, duration: 200, useNativeDriver: true }).start();
    } else if (diff < -5 || currentScrollY <= 50) {
      Animated.timing(headerTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
    lastScrollY.current = currentScrollY;
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerTranslateY }] }]}>
        <DashboardHeader onNotificationsPress={() => Alert.alert('Notifications', 'No new notifications')} />
      </Animated.View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={themeColors.primary} />}
        >
          {data && (
            <>
              <GradientBalanceCard
                totalBalance={data.balance.totalBalance}
                mainBalance={data.balance.mainBalance}
                savingsBalance={data.balance.savingsBalance}
                heldBalance={data.balance.heldBalance}
                accountCurrency={data.currency}
              />
              <ActionButtons />
              <WealthAnalyticsCard data={data.chartData} activeTab={analyticsTab} onTabChange={setAnalyticsTab} />
              <IncomeExpenseChart data={data.monthlyData} />
              <View style={styles.chartsRow}>
                <SpendingDonutChart data={data.categorySpend} totalSpend={data.totalMonthSpend} />
                <GoalsProgressCard goals={data.activeGoals} />
              </View>
              <DashboardCardsGrid
                goalsCount={data.goalsCount}
                debtsStats={data.debtsStats}
                subscriptionsCount={data.subscriptionsCount}
                categoriesCount={data.categoriesCount}
                recurringCount={data.recurringCount}
                accountCurrency={data.currency}
              />
              <MovementsList
                transactions={data.recentTransactions}
                accountCurrency={data.currency}
                onViewAll={() => navigation.navigate('TransactionHistory')}
                onTransactionPress={(t) => navigation.navigate('TransactionDetails', { transactionId: t.id })}
              />
            </>
          )}
        </ScrollView>
      </Animated.View>

      <BottomNavigation />
    </View>
  );
};

const createStyles = (tc: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.background },
  headerContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
    backgroundColor: tc.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 3,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingTop: 80, paddingBottom: 100 },
  chartsRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, gap: 12, marginBottom: spacing.md,
  },
});
