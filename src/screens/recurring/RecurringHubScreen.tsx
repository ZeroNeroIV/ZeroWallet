/**
 * Purpose: Unified Recurring & Subscriptions hub — displays subscriptions and recurring
 * expenses in one timeline with summary metrics, filter pills, countdown badges, and unified actions.
 *
 * Outputs:
 *   - Unified dashboard with monthly total commitment
 *   - Filter pills ("All", "Subscriptions", "Bills/Utilities", "Due This Week")
 *   - Quick active switch toggle, manual pay/trigger action, edit & delete
 *   - Modal picker to add either a Subscription or a Bill/Recurring Expense
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Switch,
  Modal,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import type { Subscription, RecurringExpense, Category, VaultType } from '../../types/models';
import type { MainStackParamList } from '../../types/navigation';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../constants/currencies';
import { lightHaptic, mediumHaptic, heavyHaptic } from '../../services/haptics/hapticFeedback';

type RecurringNavigationProp = StackNavigationProp<MainStackParamList, 'Recurring'>;
type RecurringRouteProp = RouteProp<MainStackParamList, 'Recurring'>;

type FilterType = 'all' | 'subscriptions' | 'recurring' | 'upcoming';

export interface UnifiedRecurringItem {
  id: string;
  kind: 'subscription' | 'recurring';
  title: string;
  amount: number;
  currency: string;
  frequencyLabel: string;
  monthlyEquivalent: number;
  nextTimestamp: number;
  isActive: boolean;
  category?: Category;
  vaultType: VaultType;
  autoRenewOrDebit: boolean;
  rawSubscription?: Subscription;
  rawRecurring?: RecurringExpense;
}

export default function RecurringHubScreen({ route }: { route?: RecurringRouteProp }) {
  const navigation = useNavigation<RecurringNavigationProp>();
  const currentAccountId = useAuthStore((state) => state.currentAccountId);
  const { subtractFromVault } = useVaultStore();
  const themeColors = useThemeColors();

  const [items, setItems] = useState<UnifiedRecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accountCurrency, setAccountCurrency] = useState<string>('USD');
  const [filter, setFilter] = useState<FilterType>(
    route?.params?.tab === 'recurring' ? 'recurring' : 'all'
  );
  const [showAddPicker, setShowAddPicker] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const loadAll = async () => {
    if (!currentAccountId) return;

    try {
      const subRepo = new SubscriptionRepository();
      const recRepo = new RecurringExpenseRepository();
      const catRepo = new CategoryRepository();
      const accRepo = new AccountRepository();

      const acc = await accRepo.findById(currentAccountId);
      if (acc?.currency) {
        setAccountCurrency(acc.currency);
      }

      const [subs, recs] = await Promise.all([
        subRepo.findByAccount(currentAccountId),
        recRepo.findByAccount(currentAccountId),
      ]);

      const categoryCache = new Map<string, Category | null>();
      const getCategory = async (catId: string) => {
        if (!catId) return undefined;
        if (categoryCache.has(catId)) return categoryCache.get(catId) ?? undefined;
        const cat = await catRepo.findById(catId);
        categoryCache.set(catId, cat);
        return cat ?? undefined;
      };

      const normalizedSubs: UnifiedRecurringItem[] = await Promise.all(
        subs.map(async (s) => {
          const category = await getCategory(s.categoryId);

          return {
            id: s.id,
            kind: 'subscription' as const,
            title: s.name,
            amount: s.amount,
            currency: acc?.currency || 'USD',
            frequencyLabel: `Day ${s.billingDay} of mo`,
            monthlyEquivalent: s.amount,
            nextTimestamp: s.nextProcessing || Date.now(),
            isActive: s.isActive,
            category,
            vaultType: s.vaultType,
            autoRenewOrDebit: true,
            rawSubscription: s,
          };
        })
      );

      const normalizedRecs: UnifiedRecurringItem[] = await Promise.all(
        recs.map(async (r) => {
          const category = await getCategory(r.categoryId);
          const interval = r.interval || 1;
          let monthlyEquivalent = r.amount;
          let freq = 'Monthly';

          if (r.frequency === 'daily') {
            monthlyEquivalent = (r.amount / interval) * 30;
            freq = interval > 1 ? `Every ${interval}d` : 'Daily';
          } else if (r.frequency === 'weekly') {
            monthlyEquivalent = (r.amount / interval) * 4.333;
            freq = interval > 1 ? `Every ${interval}w` : 'Weekly';
          } else if (r.frequency === 'yearly') {
            monthlyEquivalent = r.amount / (12 * interval);
            freq = interval > 1 ? `Every ${interval}y` : 'Yearly';
          } else {
            monthlyEquivalent = r.amount / interval;
            freq = interval > 1 ? `Every ${interval}m` : 'Monthly';
          }

          return {
            id: r.id,
            kind: 'recurring' as const,
            title: r.name,
            amount: r.amount,
            currency: acc?.currency || 'USD',
            frequencyLabel: freq,
            monthlyEquivalent,
            nextTimestamp: r.nextOccurrence || Date.now(),
            isActive: r.isActive,
            category,
            vaultType: r.vaultType,
            autoRenewOrDebit: r.autoDeduct,
            rawRecurring: r,
          };
        })
      );

      const combined = [...normalizedSubs, ...normalizedRecs];
      // Sort active items first, then by closest due date
      combined.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return a.nextTimestamp - b.nextTimestamp;
      });

      setItems(combined);
    } catch (error) {
      console.error('[RecurringHubScreen] Load error:', error);
      Alert.alert('Error', 'Failed to load recurring commitments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [currentAccountId]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [currentAccountId])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // Toggle active/pause
  const handleToggleActive = async (item: UnifiedRecurringItem) => {
    lightHaptic();
    try {
      if (item.kind === 'subscription') {
        const subRepo = new SubscriptionRepository();
        await subRepo.update(item.id, { isActive: !item.isActive });
      } else {
        const recRepo = new RecurringExpenseRepository();
        await recRepo.update(item.id, { isActive: !item.isActive });
      }
      await loadAll();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  // Pay / Trigger now
  const handleTriggerPayment = (item: UnifiedRecurringItem) => {
    mediumHaptic();
    const formattedAmt = formatCurrency(item.amount, item.currency);
    Alert.alert(
      'Confirm Payment',
      `Record payment of ${formattedAmt} for "${item.title}" now? This will record an expense transaction and advance the next due date.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          style: 'default',
          onPress: async () => {
            try {
              heavyHaptic();
              const transactionRepo = new TransactionRepository();
              const now = Date.now();

              await transactionRepo.create({
                accountId: currentAccountId!,
                type: 'expense',
                amount: item.amount,
                currency: item.currency,
                categoryId: item.category?.id || '',
                description: `${item.title} (${item.kind === 'subscription' ? 'Subscription' : 'Recurring Bill'})`,
                date: now,
                vaultType: item.vaultType,
                isRecurring: true,
                subscriptionId: item.kind === 'subscription' ? item.id : undefined,
                recurringExpenseId: item.kind === 'recurring' ? item.id : undefined,
              });

              if (item.kind === 'subscription' && item.rawSubscription) {
                const sub = item.rawSubscription;
                const nextDate = new Date(sub.nextProcessing || now);
                nextDate.setMonth(nextDate.getMonth() + 1);

                await new SubscriptionRepository().update(sub.id, {
                  nextProcessing: nextDate.getTime(),
                  lastProcessed: now,
                });
              } else if (item.kind === 'recurring' && item.rawRecurring) {
                const rec = item.rawRecurring;
                let nextDate = new Date(rec.nextOccurrence || now);
                const interval = rec.interval || 1;
                if (rec.frequency === 'daily') nextDate.setDate(nextDate.getDate() + interval);
                else if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + interval * 7);
                else if (rec.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + interval);
                else nextDate.setMonth(nextDate.getMonth() + interval);

                await new RecurringExpenseRepository().update(rec.id, {
                  nextOccurrence: nextDate.getTime(),
                  lastProcessed: now,
                });
              }

              subtractFromVault(item.vaultType, item.amount);
              await loadAll();
              Alert.alert('Success', `Payment of ${formattedAmt} recorded.`);
            } catch (err) {
              console.error('[RecurringHubScreen] Payment error:', err);
              Alert.alert('Error', 'Failed to record payment');
            }
          },
        },
      ]
    );
  };

  // Edit item
  const handleEdit = (item: UnifiedRecurringItem) => {
    lightHaptic();
    if (item.kind === 'subscription') {
      navigation.navigate('AddSubscription', {
        mode: 'edit',
        subscriptionId: item.id,
      });
    } else {
      navigation.navigate('AddRecurring', {
        mode: 'edit',
        recurringId: item.id,
      });
    }
  };

  // Delete item
  const handleDelete = (item: UnifiedRecurringItem) => {
    heavyHaptic();
    Alert.alert(
      'Delete Recurring Commitment',
      `Are you sure you want to delete "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.kind === 'subscription') {
                await new SubscriptionRepository().delete(item.id);
              } else {
                await new RecurringExpenseRepository().delete(item.id);
              }
              await loadAll();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  // Filter items
  const filteredItems = useMemo(() => {
    const now = Date.now();
    const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;

    return items.filter((item) => {
      if (filter === 'subscriptions') return item.kind === 'subscription';
      if (filter === 'recurring') return item.kind === 'recurring';
      if (filter === 'upcoming') {
        return item.isActive && item.nextTimestamp <= weekFromNow;
      }
      return true;
    });
  }, [items, filter]);

  // Summary figures
  const summary = useMemo(() => {
    const activeItems = items.filter((i) => i.isActive);
    const totalMonthly = activeItems.reduce((acc, curr) => acc + curr.monthlyEquivalent, 0);
    const activeCount = activeItems.length;

    // find upcoming closest
    const sortedUpcoming = [...activeItems].sort((a, b) => a.nextTimestamp - b.nextTimestamp);
    const nextDue = sortedUpcoming[0];

    return { totalMonthly, activeCount, nextDue };
  }, [items]);

  // Due badge helper
  const getDueBadge = (timestamp: number, isActive: boolean) => {
    if (!isActive) {
      return { text: 'Paused', bg: themeColors.surfaceHighlight, color: themeColors.textMuted };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(timestamp);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d Overdue`, bg: 'rgba(239, 68, 68, 0.15)', color: themeColors.error };
    }
    if (diffDays === 0) {
      return { text: 'Due Today', bg: 'rgba(245, 158, 11, 0.18)', color: '#F59E0B' };
    }
    if (diffDays === 1) {
      return { text: 'Due Tomorrow', bg: 'rgba(59, 130, 246, 0.15)', color: themeColors.info };
    }
    if (diffDays <= 7) {
      return { text: `In ${diffDays} days`, bg: 'rgba(16, 185, 129, 0.15)', color: themeColors.success };
    }
    return {
      text: new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      bg: themeColors.surfaceHighlight,
      color: themeColors.textSecondary,
    };
  };

  const renderItem = ({ item }: { item: UnifiedRecurringItem }) => {
    const badge = getDueBadge(item.nextTimestamp, item.isActive);
    const catColor = item.category?.color || themeColors.primary;
    const catIcon = item.category?.icon || (item.kind === 'subscription' ? 'refresh-circle' : 'repeat');

    return (
      <View style={[styles.card, !item.isActive && styles.cardInactive]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconCircle, { backgroundColor: `${catColor}25` }]}>
              <MaterialCommunityIcons name={catIcon as any} size={22} color={catColor} />
            </View>
            <View style={styles.titleCol}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.metaRow}>
                <View style={[styles.kindTag, item.kind === 'subscription' ? styles.subTag : styles.recTag]}>
                  <Text style={styles.kindTagText}>
                    {item.kind === 'subscription' ? 'Subscription' : 'Bill'}
                  </Text>
                </View>
                <Text style={styles.frequencyText}>• {item.frequencyLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardHeaderRight}>
            <Text style={styles.itemAmount}>{formatCurrency(item.amount, item.currency)}</Text>
            <View style={[styles.dueBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.dueBadgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.toggleSection}>
            <Switch
              value={item.isActive}
              onValueChange={() => handleToggleActive(item)}
              trackColor={{ false: themeColors.border, true: themeColors.primary }}
              thumbColor={item.isActive ? themeColors.onPrimary : themeColors.textMuted}
            />
            <Text style={styles.toggleLabel}>{item.isActive ? 'Active' : 'Paused'}</Text>
          </View>

          <View style={styles.cardActions}>
            {item.isActive && (
              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => handleTriggerPayment(item)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="check-circle-outline" size={16} color={themeColors.onPrimary} />
                <Text style={styles.payBtnText}>Pay Now</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleEdit(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={themeColors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Bento Summary Header */}
      <View style={styles.summaryBento}>
        <View style={styles.summaryTopRow}>
          <View>
            <Text style={styles.summarySubtitle}>TOTAL MONTHLY RECURRING</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(summary.totalMonthly, accountCurrency)}
              <Text style={styles.summaryPeriod}> / month</Text>
            </Text>
          </View>
          <View style={styles.activePill}>
            <MaterialCommunityIcons name="sync" size={14} color={themeColors.primary} />
            <Text style={styles.activePillText}>{summary.activeCount} Active</Text>
          </View>
        </View>

        {summary.nextDue && (
          <View style={styles.nextDueStrip}>
            <MaterialCommunityIcons name="bell-ring-outline" size={16} color={themeColors.primary} />
            <Text style={styles.nextDueText} numberOfLines={1}>
              Next: <Text style={styles.nextDueBold}>{summary.nextDue.title}</Text> ({formatCurrency(summary.nextDue.amount, summary.nextDue.currency)})
            </Text>
          </View>
        )}
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => { lightHaptic(); setFilter('all'); }}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
            All ({items.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'subscriptions' && styles.filterChipActive]}
          onPress={() => { lightHaptic(); setFilter('subscriptions'); }}
        >
          <Text style={[styles.filterChipText, filter === 'subscriptions' && styles.filterChipTextActive]}>
            Subscriptions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'recurring' && styles.filterChipActive]}
          onPress={() => { lightHaptic(); setFilter('recurring'); }}
        >
          <Text style={[styles.filterChipText, filter === 'recurring' && styles.filterChipTextActive]}>
            Bills & Utilities
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'upcoming' && styles.filterChipActive]}
          onPress={() => { lightHaptic(); setFilter('upcoming'); }}
        >
          <Text style={[styles.filterChipText, filter === 'upcoming' && styles.filterChipTextActive]}>
            Due Soon
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.primary}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                  <MaterialCommunityIcons name="calendar-sync" size={48} color={themeColors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No Recurring Commitments</Text>
                <Text style={styles.emptySubtitle}>
                  Track your monthly subscriptions, bills, rent, and recurring expenses all in one place.
                </Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* Floating Add Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          mediumHaptic();
          setShowAddPicker(true);
        }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={26} color={themeColors.onPrimary} />
        <Text style={styles.fabText}>Add Commitment</Text>
      </TouchableOpacity>

      {/* Unified Add Modal Sheet */}
      <Modal
        visible={showAddPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddPicker(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Recurring Commitment</Text>
            <Text style={styles.modalSubtitle}>Select what type of recurring charge you would like to track</Text>

            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => {
                setShowAddPicker(false);
                navigation.navigate('AddSubscription', undefined);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.pickerIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <MaterialCommunityIcons name="refresh-circle" size={28} color="#3B82F6" />
              </View>
              <View style={styles.pickerTextCol}>
                <Text style={styles.pickerOptionTitle}>Subscription</Text>
                <Text style={styles.pickerOptionDesc}>
                  Digital services, streaming, SaaS, memberships (e.g. Netflix, Spotify, Gym, iCloud)
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={themeColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => {
                setShowAddPicker(false);
                navigation.navigate('AddRecurring', undefined);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.pickerIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <MaterialCommunityIcons name="repeat" size={28} color="#10B981" />
              </View>
              <View style={styles.pickerTextCol}>
                <Text style={styles.pickerOptionTitle}>Bill / Recurring Expense</Text>
                <Text style={styles.pickerOptionDesc}>
                  Fixed bills, rent, utilities, internet, tuition, loans, or insurance with due dates
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={themeColors.textMuted} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    summaryBento: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: 20,
      backgroundColor: themeColors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    summaryTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    summarySubtitle: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    summaryAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: themeColors.text,
    },
    summaryPeriod: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.textSecondary,
    },
    activePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: borderRadius.round,
      backgroundColor: themeColors.surfaceHighlight,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    activePillText: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.text,
    },
    nextDueStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: themeColors.cardBorder,
    },
    nextDueText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      flex: 1,
    },
    nextDueBold: {
      fontWeight: '700',
      color: themeColors.text,
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: borderRadius.round,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    filterChipActive: {
      backgroundColor: themeColors.primary,
      borderColor: themeColors.primary,
    },
    filterChipText: {
      ...typography.caption,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    filterChipTextActive: {
      color: themeColors.onPrimary,
      fontWeight: '700',
    },
    listContainer: {
      flex: 1,
      marginTop: spacing.sm,
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 90,
      paddingTop: spacing.xs,
    },
    card: {
      backgroundColor: themeColors.surface,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    cardInactive: {
      opacity: 0.65,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      marginRight: 8,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleCol: {
      flex: 1,
    },
    itemTitle: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    kindTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    subTag: {
      backgroundColor: 'rgba(59, 130, 246, 0.14)',
    },
    recTag: {
      backgroundColor: 'rgba(16, 185, 129, 0.14)',
    },
    kindTagText: {
      fontSize: 10,
      fontWeight: '700',
      color: themeColors.text,
      textTransform: 'uppercase',
    },
    frequencyText: {
      ...typography.caption,
      color: themeColors.textMuted,
    },
    cardHeaderRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    itemAmount: {
      fontSize: 17,
      fontWeight: '700',
      color: themeColors.text,
    },
    dueBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: borderRadius.round,
    },
    dueBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: themeColors.cardBorder,
    },
    toggleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    toggleLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    payBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: themeColors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: borderRadius.md,
    },
    payBtnText: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.onPrimary,
    },
    actionIconBtn: {
      padding: 6,
      borderRadius: borderRadius.sm,
      backgroundColor: themeColors.surfaceHighlight,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      paddingHorizontal: spacing.xl,
    },
    emptyIconBg: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: themeColors.surfaceHighlight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      ...typography.h3,
      color: themeColors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      ...typography.body,
      color: themeColors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    fab: {
      position: 'absolute',
      bottom: spacing.lg,
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: themeColors.primary,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: borderRadius.round,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
    },
    fabText: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.onPrimary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingBottom: 40,
      paddingTop: 12,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    modalHandle: {
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: themeColors.cardBorder,
      alignSelf: 'center',
      marginBottom: 18,
    },
    modalTitle: {
      ...typography.h3,
      color: themeColors.text,
      fontWeight: '700',
      marginBottom: 4,
    },
    modalSubtitle: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      marginBottom: 20,
    },
    pickerOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: themeColors.surfaceHighlight,
      borderRadius: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      gap: 14,
    },
    pickerIconBg: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerTextCol: {
      flex: 1,
    },
    pickerOptionTitle: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 2,
    },
    pickerOptionDesc: {
      ...typography.caption,
      color: themeColors.textMuted,
      lineHeight: 18,
    },
  });
