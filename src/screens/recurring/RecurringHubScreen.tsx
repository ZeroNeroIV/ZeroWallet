// Simplizum Recurring Hub — Multi-Horizon Projections, Unified Architectural Timeline, & Cadence Intelligence
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, differenceInDays } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { RecurringRepository } from '../../database/repositories/RecurringRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { syncBalancesFromDatabase } from '../../services/walletTransferService';
import type { RecurringTransaction, Category, Wallet, FrequencyUnit, VaultType } from '../../types/models';
import type { MainStackParamList } from '../../types/navigation';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import { RecurringFormModal } from '../../components/recurring/RecurringFormModal';

type NavProp = StackNavigationProp<MainStackParamList, 'Recurring'>;

type FilterTab = 'all' | 'subscriptions' | 'bills';

interface EnrichedRecurringItem extends RecurringTransaction {
  category?: Category;
  walletName?: string;
  monthlyCost: number;
  daysUntilDue: number;
}

export default function RecurringHubScreen() {
  const navigation = useNavigation<NavProp>();
  const { currentAccountId, currentUser } = useAuthStore();
  const themeColors = useThemeColors();

  const [items, setItems] = useState<EnrichedRecurringItem[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  // Form modal
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);

  const recurringRepo = useMemo(() => new RecurringRepository(), []);

  const loadData = useCallback(async () => {
    if (!currentAccountId || !currentUser) return;
    try {
      const walletRepo = new WalletRepository();
      const catRepo = new CategoryRepository();
      const accRepo = new AccountRepository();

      const [recurringList, wList, cList, acc] = await Promise.all([
        recurringRepo.findByAccount(currentAccountId),
        walletRepo.findByAccount(currentAccountId),
        catRepo.findByUser(currentUser.id),
        accRepo.findById(currentAccountId),
      ]);

      if (acc?.currency) setAccountCurrency(acc.currency);
      setWallets(wList);
      setCategories(cList);

      const catMap = new Map<string, Category>();
      cList.forEach((c) => catMap.set(c.id, c));

      const walletMap = new Map<string, string>();
      wList.forEach((w) => walletMap.set(w.id, w.name));

      const now = Date.now();
      const enriched: EnrichedRecurringItem[] = recurringList.map((r) => {
        const monthlyCost = recurringRepo.getMonthlyEquivalent(r);
        const daysUntil = Math.ceil((r.nextRunDate - now) / (1000 * 60 * 60 * 24));
        return {
          ...r,
          category: r.categoryId ? catMap.get(r.categoryId) : undefined,
          walletName: walletMap.get(r.walletId) || r.walletId,
          monthlyCost,
          daysUntilDue: daysUntil,
        };
      });

      setItems(enriched);
    } catch (err) {
      console.warn('[RecurringHubScreen] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccountId, currentUser, recurringRepo]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Multi-Horizon Projections (User Answer 2)
  const projections = useMemo(() => {
    let monthlyBurn = 0;
    let activeCount = 0;

    for (const item of items) {
      if (item.isActive) {
        monthlyBurn += item.monthlyCost;
        activeCount++;
      }
    }

    const annualBurn = monthlyBurn * 12;
    return {
      monthlyBurn,
      annualBurn,
      activeCount,
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterTab === 'subscriptions') return item.isSubscription;
      if (filterTab === 'bills') return !item.isSubscription;
      return true;
    });
  }, [items, filterTab]);

  // Toggle active / paused state
  const handleToggleActive = async (item: EnrichedRecurringItem) => {
    triggerHaptic('selection');
    try {
      await recurringRepo.update(item.id, { isActive: !item.isActive });
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update commitment state.');
    }
  };

  // Immediate manual payment execution
  const handleManualDeductNow = async (item: EnrichedRecurringItem) => {
    Alert.alert(
      'Manual Payment',
      `Record a ${formatCurrency(item.amount, accountCurrency)} transaction for "${item.name}" immediately?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay & Advance Due Date',
          onPress: async () => {
            try {
              if (!currentAccountId) return;
              const txRepo = new TransactionRepository();
              const now = Date.now();

              // 1. Log transaction
              await txRepo.create({
                accountId: currentAccountId,
                type: item.type === 'income' ? 'income' : 'expense',
                amount: item.amount,
                categoryId: item.categoryId || '',
                description: `${item.name} (Recurring Payment)`,
                date: now,
                vaultType: item.walletId as VaultType,
                walletId: item.walletId,
                isRecurring: true,
                currency: accountCurrency,
              });

              // 2. Advance nextRunDate
              const nextDate = recurringRepo.calculateNextRunDate(
                item.nextRunDate,
                item.frequencyUnit,
                item.frequencyInterval,
                item.billingDay
              );

              await recurringRepo.update(item.id, {
                lastRunDate: now,
                nextRunDate: nextDate,
              });

              await syncBalancesFromDatabase(currentAccountId);
              triggerHaptic('notificationSuccess');
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to record payment.');
            }
          },
        },
      ]
    );
  };

  const handleItemPress = (item: EnrichedRecurringItem) => {
    Alert.alert(
      item.name,
      `${formatCurrency(item.amount, accountCurrency)} • ${formatCadenceText(item)}`,
      [
        {
          text: 'Trigger Payment Now',
          onPress: () => handleManualDeductNow(item),
        },
        {
          text: 'Edit Commitment',
          onPress: () => {
            setEditingItem(item);
            setFormModalVisible(true);
          },
        },
        {
          text: item.isActive ? 'Pause Commitment' : 'Resume Commitment',
          onPress: () => handleToggleActive(item),
        },
        {
          text: 'Delete Commitment',
          style: 'destructive',
          onPress: () => handleDeleteItem(item),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDeleteItem = async (item: EnrichedRecurringItem) => {
    Alert.alert(
      'Delete Recurring Commitment',
      `Are you sure you want to delete "${item.name}"? Past recorded transactions will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await recurringRepo.delete(item.id);
              triggerHaptic('notificationSuccess');
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete commitment.');
            }
          },
        },
      ]
    );
  };

  const handleSaveModal = async (data: {
    id?: string;
    name: string;
    amount: number;
    walletId: string;
    categoryId?: string;
    frequencyUnit: FrequencyUnit;
    frequencyInterval: number;
    billingDay?: number | null;
    startDate: number;
    autoDeduct: boolean;
    reminderDaysBefore: number;
    isSubscription: boolean;
  }) => {
    const nextRun = recurringRepo.calculateNextRunDate(
      data.startDate,
      data.frequencyUnit,
      data.frequencyInterval,
      data.billingDay
    );

    if (data.id) {
      await recurringRepo.update(data.id, {
        name: data.name,
        amount: data.amount,
        walletId: data.walletId,
        categoryId: data.categoryId || null,
        frequencyUnit: data.frequencyUnit,
        frequencyInterval: data.frequencyInterval,
        billingDay: data.billingDay,
        autoDeduct: data.autoDeduct,
        reminderDaysBefore: data.reminderDaysBefore,
        isSubscription: data.isSubscription,
      });
    } else {
      await recurringRepo.create({
        name: data.name,
        type: 'expense',
        amount: data.amount,
        walletId: data.walletId,
        categoryId: data.categoryId || null,
        frequencyUnit: data.frequencyUnit,
        frequencyInterval: data.frequencyInterval,
        billingDay: data.billingDay,
        startDate: data.startDate,
        nextRunDate: nextRun,
        autoDeduct: data.autoDeduct,
        reminderDaysBefore: data.reminderDaysBefore,
        isSubscription: data.isSubscription,
        isActive: true,
      });
    }

    await loadData();
  };

  const formatCadenceText = (item: RecurringTransaction) => {
    const interval = item.frequencyInterval || 1;
    if (interval === 1) {
      return item.frequencyUnit.toUpperCase();
    }
    return `EVERY ${interval} ${item.frequencyUnit.toUpperCase()}S`;
  };

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <ScrollView
        style={styles.scroll}
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
        {/* 1. Multi-Horizon Projections Header Card (User Answer 2) */}
        <View
          style={[
            styles.projectionsCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          <View style={styles.projectionsRow}>
            {/* Monthly Burn */}
            <View style={styles.projectionItem}>
              <Text style={[styles.projLabel, { color: themeColors.textMuted }]}>
                MONTHLY BURN
              </Text>
              <Text style={[styles.projValue, { color: themeColors.text }]}>
                {formatCurrency(projections.monthlyBurn, accountCurrency)}
              </Text>
            </View>

            <View style={[styles.projDivider, { backgroundColor: themeColors.hairline }]} />

            {/* Annual Burn */}
            <View style={styles.projectionItem}>
              <Text style={[styles.projLabel, { color: themeColors.textMuted }]}>
                ANNUAL BURN
              </Text>
              <Text style={[styles.projValue, { color: themeColors.text }]}>
                {formatCurrency(projections.annualBurn, accountCurrency)}
              </Text>
            </View>

            <View style={[styles.projDivider, { backgroundColor: themeColors.hairline }]} />

            {/* Active Commitments */}
            <View style={styles.projectionItem}>
              <Text style={[styles.projLabel, { color: themeColors.textMuted }]}>
                ACTIVE
              </Text>
              <Text style={[styles.projValue, { color: themeColors.text }]}>
                {projections.activeCount} COMMITMENTS
              </Text>
            </View>
          </View>

          {/* New Commitment Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('selection');
              setEditingItem(null);
              setFormModalVisible(true);
            }}
            style={[
              styles.newCommitmentBtn,
              {
                borderColor: themeColors.text,
                backgroundColor: themeColors.text,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="plus"
              size={16}
              color={themeColors.background}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.newCommitmentBtnText, { color: themeColors.background }]}>
              NEW COMMITMENT
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Filter Pills Rail (User Answer 1) */}
        <View style={styles.filterPillsRow}>
          {[
            { id: 'all', label: 'ALL COMMITMENTS' },
            { id: 'subscriptions', label: 'SUBSCRIPTIONS' },
            { id: 'bills', label: 'RECURRING BILLS' },
          ].map((tab) => {
            const isSelected = filterTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic('selection');
                  setFilterTab(tab.id as FilterTab);
                }}
                style={[
                  styles.filterPill,
                  {
                    borderColor: isSelected ? themeColors.text : themeColors.hairline,
                    backgroundColor: isSelected ? themeColors.text : themeColors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isSelected ? themeColors.background : themeColors.text,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 3. Unified Architectural Timeline */}
        <View style={styles.timelineSection}>
          {loading && !refreshing ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator color={themeColors.text} size="small" />
            </View>
          ) : filteredItems.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.cardBorder,
                },
              ]}
            >
              <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                No recurring commitments found in this view.
              </Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const isOverdue = item.daysUntilDue < 0;
              const isDueSoon = item.daysUntilDue >= 0 && item.daysUntilDue <= 3;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.75}
                  onPress={() => handleItemPress(item)}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: themeColors.surface,
                      borderColor: themeColors.cardBorder,
                      opacity: item.isActive ? 1 : 0.5,
                    },
                  ]}
                >
                  {/* Left: Icon Badge & Titles */}
                  <View style={styles.itemLeft}>
                    <View
                      style={[
                        styles.itemIconBadge,
                        {
                          backgroundColor: themeColors.background,
                          borderColor: themeColors.hairline,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.isSubscription ? 'television-play' : 'calendar-clock'}
                        size={18}
                        color={themeColors.text}
                      />
                    </View>

                    <View style={styles.itemMetaCol}>
                      <Text
                        style={[styles.itemName, { color: themeColors.text }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>

                      <View style={styles.tagsRow}>
                        <Text style={[styles.cadenceTag, { color: themeColors.textMuted }]}>
                          {formatCadenceText(item)}
                        </Text>
                        <Text style={[styles.walletTag, { color: themeColors.textMuted }]}>
                          • {item.walletName}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right: Due Date & Tabular Amount */}
                  <View style={styles.itemRight}>
                    <Text style={[styles.itemAmount, { color: themeColors.text }]}>
                      {formatCurrency(item.amount, accountCurrency)}
                    </Text>

                    {/* Countdown / Due Status Pill */}
                    <View
                      style={[
                        styles.duePill,
                        {
                          borderColor: isOverdue
                            ? themeColors.error
                            : isDueSoon
                            ? themeColors.warning
                            : themeColors.hairline,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.duePillText,
                          {
                            color: isOverdue
                              ? themeColors.error
                              : isDueSoon
                              ? themeColors.warning
                              : themeColors.textMuted,
                          },
                        ]}
                      >
                        {isOverdue
                          ? `${Math.abs(item.daysUntilDue)}D OVERDUE`
                          : item.daysUntilDue === 0
                          ? 'DUE TODAY'
                          : `IN ${item.daysUntilDue}D`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Unified Add / Edit Form Modal */}
      <RecurringFormModal
        visible={formModalVisible}
        item={editingItem}
        wallets={wallets}
        categories={categories}
        currency={accountCurrency}
        onClose={() => setFormModalVisible(false)}
        onSave={handleSaveModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  projectionsCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 16,
    marginBottom: 16,
  },
  projectionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  projectionItem: {
    flex: 1,
  },
  projLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  projValue: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  projDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 12,
  },
  newCommitmentBtn: {
    height: 42,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCommitmentBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  timelineSection: {
    gap: 10,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    padding: 28,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  itemIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemMetaCol: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cadenceTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  walletTag: {
    fontSize: 10,
    marginLeft: 4,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  duePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 2,
  },
  duePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
