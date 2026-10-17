import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  DashboardService,
  type DashboardData,
  type TransactionWithCat,
} from '../../services/dashboardService';
import type { Wallet } from '../../types/models';

// Simplizum Precision Components
import { SimplizumHeader } from '../../components/dashboard/SimplizumHeader';
import { SimplizumHero } from '../../components/dashboard/SimplizumHero';
import { RecurringTicker } from '../../components/dashboard/RecurringTicker';
import { ActionDuo } from '../../components/dashboard/ActionDuo';
import { CashFlowTrend } from '../../components/dashboard/CashFlowTrend';
import { ChronologicalMovements } from '../../components/dashboard/ChronologicalMovements';
import { GoalsDebtsPreview } from '../../components/dashboard/GoalsDebtsPreview';
import { useNavigationTabStore } from '../../store/navigationTabStore';

type NavProp = StackNavigationProp<MainStackParamList, 'Dashboard'>;

const EMPTY_WALLETS: Wallet[] = [];
const EMPTY_BALANCES: Record<string, number> = {};

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId);
  const dataRevision = useAccountStore((s) => s.dataRevision);
  const isBalanceHidden = useUIStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useUIStore((s) => s.toggleBalanceHidden);
  const aiSettings = useSettingsStore((s) => s.aiSettings) || { isConfigured: false };

  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const getService = useCallback(() => {
    if (!currentAccountId || !currentUser) return null;
    return new DashboardService(currentAccountId, currentUser.id);
  }, [currentAccountId, currentUser]);

  const loadData = useCallback(async () => {
    const svc = getService();
    if (!svc) return;
    try {
      const result = await svc.loadAll();
      setData(result);
    } catch (err) {
      console.error('[DashboardScreen] Failed to load dashboard data:', err);
    }
  }, [getService]);

  const checkTasks = useCallback(async () => {
    const svc = getService();
    if (!svc) return;
    const notifications = await svc.checkBackgroundTasks();
    if (notifications.length > 0) {
      Alert.alert('🔔 Scheduled Updates', notifications.join('\n\n'), [{ text: 'OK' }]);
    }
  }, [getService]);

  // Focus effect for screen revisit
  useFocusEffect(
    useCallback(() => {
      if (!currentAccountId || !currentUser) return;
      loadData();
      checkTasks();
    }, [currentAccountId, currentUser, loadData, checkTasks])
  );

  // Reload when user switches to Dashboard tab or when database mutations occur
  const activeTabIndex = useNavigationTabStore((s) => s.activeTabIndex);
  useEffect(() => {
    if (activeTabIndex === 0 && currentAccountId && currentUser) {
      loadData();
    }
  }, [activeTabIndex, currentAccountId, currentUser, dataRevision, loadData]);

  // Reload when app returns from background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadData();
      }
    });
    return () => sub.remove();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleAIPress = useCallback(() => {
    if (aiSettings.isConfigured) {
      navigation.navigate('ChatScreen');
    } else {
      Alert.alert(
        'AI Assistant',
        'Setup your AI key in Settings to get smart spending analytics and insights.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Configure', onPress: () => navigation.navigate('AISettings') },
        ]
      );
    }
  }, [aiSettings.isConfigured, navigation]);

  const handleSearchPress = useCallback(
    () => navigation.navigate('TransactionHistory'),
    [navigation],
  );
  const handleLockPress = useCallback(
    () => navigation.navigate('SecuritySettings'),
    [navigation],
  );
  const handleSelectWallet = useCallback(
    (wallet: Wallet) => navigation.navigate('WalletDetails', { walletId: wallet.id }),
    [navigation],
  );
  const handleCreateWallet = useCallback(
    () => navigation.navigate('Wallets'),
    [navigation],
  );
  const handleRecurringPress = useCallback(
    () => useNavigationTabStore.getState().scrollToTab(2),
    [],
  );
  const handleLogTransaction = useCallback(
    () => navigation.navigate('AddTransaction', { type: 'expense' }),
    [navigation],
  );
  const handleTransfer = useCallback(
    () => navigation.navigate('Transfer'),
    [navigation],
  );
  const handleViewAllGoalsDebts = useCallback(
    () => navigation.navigate('GoalsDebtsHub'),
    [navigation],
  );
  const handleSelectGoals = useCallback(
    () => navigation.navigate('GoalsDebtsHub', { initialTab: 'goals' }),
    [navigation],
  );
  const handleSelectDebts = useCallback(
    () => navigation.navigate('GoalsDebtsHub', { initialTab: 'debts' }),
    [navigation],
  );
  const handleSelectTransaction = useCallback(
    (tx: TransactionWithCat) =>
      navigation.navigate('TransactionDetails', { transactionId: tx.id }),
    [navigation],
  );

  const activeWallets = data?.wallets && data.wallets.length > 0 ? data.wallets : EMPTY_WALLETS;
  const derivedBalances = data?.derivedBalances || EMPTY_BALANCES;

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
      {/* 1. Command Header */}
      <SimplizumHeader
        onSearchPress={handleSearchPress}
        onAIPress={handleAIPress}
        onLockPress={handleLockPress}
      />

      {/* 2. Main Editorial Core Scroll View */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.text}
            />
          }
        >
          {data && (
            <>
              {/* Hero: Total Net Worth + Minimalist Wallets Strip */}
              <SimplizumHero
                totalBalance={data.balance.totalBalance}
                currency={data.currency}
                isBalanceHidden={isBalanceHidden}
                onToggleHideBalance={toggleBalanceHidden}
                wallets={activeWallets}
                walletBalances={derivedBalances}
                onSelectWallet={handleSelectWallet}
                onCreateWallet={handleCreateWallet}
              />

              {/* Upcoming Recurring Ticker (1-line) */}
              <RecurringTicker
                item={data.upcomingRecurring}
                currency={data.currency}
                isBalanceHidden={isBalanceHidden}
                onPress={handleRecurringPress}
              />

              {/* Action Duo: Log & Transfer */}
              <ActionDuo
                onLogTransaction={handleLogTransaction}
                onTransfer={handleTransfer}
              />

              {/* Financial Horizons: Goals & Debts commitments */}
              <GoalsDebtsPreview
                activeGoals={data.activeGoals}
                goalsCount={data.goalsCount}
                activeDebts={data.activeDebts}
                debtsStats={data.debtsStats}
                currency={data.currency}
                isBalanceHidden={isBalanceHidden}
                onViewAll={handleViewAllGoalsDebts}
                onSelectGoals={handleSelectGoals}
                onSelectDebts={handleSelectDebts}
              />

              {/* 30-Day Cash Flow Hairline Trend Chart */}
              <CashFlowTrend
                data={data.trend30Day}
                netChange={data.net30DayChange}
                currency={data.currency}
                isBalanceHidden={isBalanceHidden}
              />

              {/* Chronological Movements: Today & Yesterday */}
              <ChronologicalMovements
                transactions={data.recentTransactions}
                wallets={activeWallets}
                currency={data.currency}
                isBalanceHidden={isBalanceHidden}
                onSelectTransaction={handleSelectTransaction}
                onViewAll={handleSearchPress}
              />
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
});
