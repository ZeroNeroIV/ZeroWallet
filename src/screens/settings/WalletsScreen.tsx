// Simplizum Wallets Hub — Unified Single-Tier Architectural List & Net Worth Command Header
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { MainStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNavigationTabStore } from '../../store/navigationTabStore';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { useWallets } from '../../hooks/useWallets';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import { WalletArchitecturalCard } from '../../components/wallets/WalletArchitecturalCard';
import { WalletFormModal } from '../../components/wallets/WalletFormModal';
import type { Wallet } from '../../types/models';

type NavigationProp = StackNavigationProp<MainStackParamList, 'Wallets'>;

export default function WalletsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useThemeColors();
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentAccountId = useAuthStore((s) => s.currentAccountId);
  const isBalanceHidden = useUIStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useUIStore((s) => s.toggleBalanceHidden);

  const { wallets, refresh } = useWallets();
  const [derivedBalances, setDerivedBalances] = useState<Record<string, number>>({});
  const [currency, setCurrency] = useState('USD');
  const [refreshing, setRefreshing] = useState(false);

  // Form modal state
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  const loadData = useCallback(async () => {
    if (!currentAccountId) return;
    try {
      const [acc, balances] = await Promise.all([
        new AccountRepository().findById(currentAccountId),
        new WalletRepository().getDerivedBalances(currentAccountId),
      ]);
      if (acc?.currency) setCurrency(acc.currency);
      setDerivedBalances(balances);
    } catch (err) {
      console.warn('[WalletsScreen] loadData error:', err);
    }
  }, [currentAccountId]);

  const insets = useSafeAreaInsets();
  const activeTabIndex = useNavigationTabStore((s) => s.activeTabIndex);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadData();
    }, [refresh, loadData])
  );

  // Reload when user switches to Wallets tab
  useEffect(() => {
    if (activeTabIndex === 1) {
      refresh();
      loadData();
    }
  }, [activeTabIndex, refresh, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadData()]);
    setRefreshing(false);
  };

  // Calculate Net Worth across all wallets
  const totalNetWorth = useMemo(() => {
    let sum = 0;
    for (const w of wallets) {
      sum += derivedBalances[w.id] ?? 0;
    }
    return sum;
  }, [wallets, derivedBalances]);

  // Sort wallets: highest balance first
  const sortedWallets = useMemo(() => {
    return [...wallets].sort((a, b) => {
      const balA = derivedBalances[a.id] ?? 0;
      const balB = derivedBalances[b.id] ?? 0;
      return balB - balA;
    });
  }, [wallets, derivedBalances]);

  const handleWalletPress = (wallet: Wallet) => {
    navigation.navigate('WalletDetails', { walletId: wallet.id });
  };

  const handleWalletLongPress = (wallet: Wallet) => {
    Alert.alert(
      wallet.name,
      `Balance: ${formatCurrency(derivedBalances[wallet.id] ?? 0, currency)}`,
      [
        {
          text: wallet.isDefault ? 'Default Wallet' : 'Set as Default',
          onPress: async () => {
            if (wallet.isDefault || !currentAccountId) return;
            const repo = new WalletRepository();
            const all = await repo.findByAccount(currentAccountId);
            for (const item of all) {
              if (item.isDefault && item.id !== wallet.id) {
                await repo.update(item.id, { isDefault: false }, currentAccountId);
              }
            }
            await repo.update(wallet.id, { isDefault: true }, currentAccountId);
            triggerHaptic('notificationSuccess');
            refresh();
          },
        },
        {
          text: 'Edit Wallet',
          onPress: () => {
            setEditingWallet(wallet);
            setFormModalVisible(true);
          },
        },
        {
          text: 'Delete Wallet',
          style: 'destructive',
          onPress: () => handleDeleteWallet(wallet),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDeleteWallet = async (wallet: Wallet) => {
    if (wallets.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one active wallet.');
      return;
    }

    const otherWallets = wallets.filter((w) => w.id !== wallet.id);
    const destination = otherWallets[0];

    Alert.alert(
      'Delete Wallet',
      `Delete "${wallet.name}"? All its past transactions will be reallocated to "${destination.name}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Reassign',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!currentAccountId) return;
              const repo = new WalletRepository();
              await repo.delete(wallet.id, currentAccountId, destination.id);
              triggerHaptic('notificationSuccess');
              await Promise.all([refresh(), loadData()]);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete wallet.');
            }
          },
        },
      ]
    );
  };

  const handleSaveWallet = async (data: {
    id?: string;
    name: string;
    icon: string;
    color: string;
    isDefault: boolean;
    initialBalance?: number;
  }) => {
    if (!currentAccountId || !currentUser) return;
    const repo = new WalletRepository();

    if (data.id) {
      // Update existing
      await repo.update(
        data.id,
        {
          name: data.name,
          icon: data.icon,
          color: data.color,
          isDefault: data.isDefault,
        },
        currentAccountId
      );
    } else {
      // Create new
      const created = await repo.create({
        accountId: currentAccountId,
        name: data.name,
        icon: data.icon,
        color: data.color,
        isDefault: data.isDefault,
        sortOrder: wallets.length,
      });

      // If initial starting balance was supplied, create initial deposit transaction
      if (data.initialBalance && data.initialBalance > 0) {
        const catRepo = new CategoryRepository();
        const txRepo = new TransactionRepository();
        const depositCat = await catRepo.ensureTransferCategory(currentUser.id, 'income');

        await txRepo.create({
          accountId: currentAccountId,
          type: 'income',
          amount: data.initialBalance,
          categoryId: depositCat.id,
          description: `Initial balance for ${data.name}`,
          date: Date.now(),
          vaultType: created.id,
          walletId: created.id,
          isRecurring: false,
          currency,
        });
      }
    }

    // If marked default, unset others
    if (data.isDefault) {
      const all = await repo.findByAccount(currentAccountId);
      for (const item of all) {
        if (item.isDefault && item.id !== (data.id || '')) {
          await repo.update(item.id, { isDefault: false }, currentAccountId);
        }
      }
    }

    await Promise.all([refresh(), loadData()]);
  };

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      {/* Simplizum In-Screen Architectural Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            borderBottomColor: themeColors.hairline,
            backgroundColor: themeColors.background,
          },
        ]}
      >
        <View style={styles.headerLeftGroup}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('impactLight');
                navigation.goBack();
              }}
              style={[
                styles.headerBackBtn,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.surface,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons name="arrow-left" size={18} color={themeColors.text} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={[styles.headerSuper, { color: themeColors.textMuted }]}>
              ZERO WALLET · LEDGER
            </Text>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>
              WALLETS
            </Text>
          </View>
        </View>

        <View style={styles.headerRightGroup}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic('selection');
              toggleBalanceHidden();
            }}
            style={[
              styles.headerActionBtn,
              {
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.surface,
              },
            ]}
            accessibilityLabel="Toggle Balance Visibility"
          >
            <MaterialCommunityIcons
              name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={themeColors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic('selection');
              setEditingWallet(null);
              setFormModalVisible(true);
            }}
            style={[
              styles.headerActionBtn,
              {
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.surface,
              },
            ]}
            accessibilityLabel="Add New Wallet"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="plus" size={18} color={themeColors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === 'ios' ? 120 : 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.text}
          />
        }
      >
        {/* Command Net Worth Header Card */}
        <View
          style={[
            styles.commandCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          <View style={styles.commandTopRow}>
            <Text style={[styles.commandMicroLabel, { color: themeColors.textMuted }]}>
              TOTAL NET WORTH
            </Text>
            <Text style={[styles.walletCountBadge, { color: themeColors.textMuted }]}>
              {wallets.length} WALLETS
            </Text>
          </View>

          <Text style={[styles.commandAmountText, { color: themeColors.text }]}>
            {isBalanceHidden ? '••••••••' : formatCurrency(totalNetWorth, currency)}
          </Text>

          {/* Transfer Action */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('selection');
              navigation.navigate('Transfer');
            }}
            style={[
              styles.actionBtn,
              {
                borderColor: themeColors.cardBorder,
                backgroundColor: themeColors.background,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="swap-vertical"
              size={16}
              color={themeColors.text}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.actionBtnText, { color: themeColors.text }]}>
              TRANSFER FUNDS
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>
            ARCHITECTURAL LEDGER
          </Text>
          <Text style={[styles.sectionSub, { color: themeColors.textMuted }]}>
            SORTED BY BALANCE
          </Text>
        </View>

        {/* Unified Single-Tier Architectural List */}
        <View style={styles.listContainer}>
          {sortedWallets.map((wallet) => (
            <WalletArchitecturalCard
              key={wallet.id}
              wallet={wallet}
              balance={derivedBalances[wallet.id] ?? 0}
              currency={currency}
              isBalanceHidden={isBalanceHidden}
              onPress={() => handleWalletPress(wallet)}
              onLongPress={() => handleWalletLongPress(wallet)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Add / Edit Wallet Modal */}
      <WalletFormModal
        visible={formModalVisible}
        wallet={editingWallet}
        currency={currency}
        onClose={() => setFormModalVisible(false)}
        onSave={handleSaveWallet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSuper: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 20,
    letterSpacing: 0.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  commandCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs, // 2px subtle corner
    padding: 18,
    marginBottom: 24,
  },
  commandTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commandMicroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  walletCountBadge: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  commandAmountText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    marginBottom: 18,
  },
  actionBtn: {
    width: '100%',
    height: 42,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionSub: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  listContainer: {
    marginTop: 2,
  },
});
