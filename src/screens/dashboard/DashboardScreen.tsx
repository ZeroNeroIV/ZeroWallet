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
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { DashboardService, type DashboardData } from '../../services/dashboardService';
import { useWallets } from '../../hooks/useWallets';

// Simplizum Precision Components
import { SimplizumHeader } from '../../components/dashboard/SimplizumHeader';
import { SimplizumHero } from '../../components/dashboard/SimplizumHero';
import { RecurringTicker } from '../../components/dashboard/RecurringTicker';
import { ActionDuo } from '../../components/dashboard/ActionDuo';
import { CashFlowTrend } from '../../components/dashboard/CashFlowTrend';
import { ChronologicalMovements } from '../../components/dashboard/ChronologicalMovements';
import { BottomNavigation } from '../../components/navigation/BottomNavigation';

type NavProp = StackNavigationProp<MainStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId);
  const isBalanceHidden = useUIStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useUIStore((s) => s.toggleBalanceHidden);
  const aiSettings = useSettingsStore((s) => s.aiSettings) || { isConfigured: false };

  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const { wallets } = useWallets();

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
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error('[DashboardScreen] Failed to load dashboard data:', err);
    }
  }, [getService, fadeAnim]);

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

  // Reload when app returns from background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadData();
      }
    });
    return () => sub.remove();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAIPress = () => {
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
  };

  const activeWallets = data?.wallets && data.wallets.length > 0 ? data.wallets : wallets;
  const derivedBalances = data?.derivedBalances || {};

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
      {/* 1. Command Header */}
      <SimplizumHeader
        onSearchPress={() => navigation.navigate('TransactionHistory')}
        onAIPress={handleAIPress}
        onLockPress={() => navigation.navigate('SecuritySettings')}
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
                onSelectWallet={(wallet) => navigation.navigate('WalletDetails', { walletId: wallet.id })}
                onCreateWallet={() => navigation.navigate('Wallets')}
              />

              {/* Upcoming Recurring Ticker (1-line) */}
              <RecurringTicker
                item={data.upcomingRecurring}
                currency={data.currency}
                onPress={() => navigation.navigate('Recurring')}
              />

              {/* Action Duo: Log & Transfer */}
              <ActionDuo
                onLogTransaction={() => navigation.navigate('AddTransaction', { type: 'expense' })}
                onTransfer={() => navigation.navigate('Transfer')}
              />

              {/* 30-Day Cash Flow Hairline Trend Chart */}
              <CashFlowTrend
                data={data.trend30Day}
                netChange={data.net30DayChange}
                currency={data.currency}
              />

              {/* Chronological Movements: Today & Yesterday */}
              <ChronologicalMovements
                transactions={data.recentTransactions}
                wallets={activeWallets}
                currency={data.currency}
                onSelectTransaction={(tx) =>
                  navigation.navigate('TransactionDetails', { transactionId: tx.id })
                }
                onViewAll={() => navigation.navigate('TransactionHistory')}
              />
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* 3. Floating Minimalist Rail */}
      <BottomNavigation />
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
