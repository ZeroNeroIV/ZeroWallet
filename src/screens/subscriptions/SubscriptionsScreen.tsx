/**
 * Purpose: Displays all subscriptions with active/inactive status and management actions
 * 
 * Inputs:
 *   - None (navigation screen)
 * 
 * Outputs:
 *   - Returns (JSX.Element): Subscriptions list screen with add/edit/toggle actions
 * 
 * Side effects:
 *   - Loads subscriptions from database on mount and focus
 *   - Navigates to AddSubscription screen
 *   - Toggles subscription active/inactive status
 *   - Deletes subscriptions
 *   - Refreshes subscription list
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import type { Subscription, Category } from '../../types/models';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Button } from '../../components/forms/Button';
import { useThemeColors } from '../../hooks/useThemeColors';
import { format } from 'date-fns';

type SubscriptionsNavigationProp = StackNavigationProp<
  MainStackParamList,
  'SubscriptionsScreen'
>;

interface SubscriptionWithCategory extends Subscription {
  category: Category;
}

export default function SubscriptionsScreen() {
  const navigation = useNavigation<SubscriptionsNavigationProp>();
  const currentAccountId = useAuthStore((state) => state.currentAccountId);
  const themeColors = useThemeColors();

  const [subscriptions, setSubscriptions] = useState<SubscriptionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const loadSubscriptions = async () => {
    if (!currentAccountId) return;

    try {
      const subscriptionRepo = new SubscriptionRepository();
      const categoryRepo = new CategoryRepository();

      const subs = await subscriptionRepo.findByAccount(currentAccountId);

      // Load category for each subscription
      const subsWithCategories = await Promise.all(
        subs.map(async (sub) => {
          const category = await categoryRepo.findById(sub.categoryId);
          return {
            ...sub,
            category: category!,
          };
        })
      );

      setSubscriptions(subsWithCategories);
    } catch (error) {
      console.error('[SubscriptionsScreen] Failed to load subscriptions:', error);
      Alert.alert('Error', 'Failed to load subscriptions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
    }, [currentAccountId])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadSubscriptions();
  };

  const handleAddSubscription = () => {
    navigation.navigate('AddSubscription');
  };

  const handleEditSubscription = (subscription: Subscription) => {
    navigation.navigate('AddSubscription', {
      mode: 'edit',
      subscriptionId: subscription.id,
    });
  };

  const handleToggleActive = async (subscription: Subscription) => {
    try {
      const subscriptionRepo = new SubscriptionRepository();
      await subscriptionRepo.update(subscription.id, {
        isActive: !subscription.isActive,
      });
      loadSubscriptions();
    } catch (error) {
      console.error('[SubscriptionsScreen] Failed to toggle subscription:', error);
      Alert.alert('Error', 'Failed to update subscription');
    }
  };

  const handleDeleteSubscription = (subscription: Subscription) => {
    Alert.alert(
      'Delete Subscription',
      `Are you sure you want to delete "${subscription.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const subscriptionRepo = new SubscriptionRepository();
              await subscriptionRepo.delete(subscription.id);
              Alert.alert('Success', 'Subscription deleted successfully');
              loadSubscriptions();
            } catch (error) {
              console.error('[SubscriptionsScreen] Failed to delete subscription:', error);
              Alert.alert('Error', 'Failed to delete subscription');
            }
          },
        },
      ]
    );
  };

  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };

  const renderSubscriptionItem = ({ item }: { item: SubscriptionWithCategory }) => (
    <TouchableOpacity
      style={[
        styles.subscriptionItem,
        !item.isActive && styles.subscriptionItemInactive,
      ]}
      onPress={() => handleEditSubscription(item)}
      activeOpacity={0.7}
    >
      <View style={styles.subscriptionLeft}>
        <View style={[styles.iconCircle, { backgroundColor: item.category.color }]}>
          <Icon name={item.category.icon} size={24} color="#FFFFFF" />
        </View>
        <View style={styles.subscriptionInfo}>
          <Text style={[styles.subscriptionName, !item.isActive && styles.textInactive]}>
            {item.name}
          </Text>
          <Text style={styles.subscriptionDetails}>
            ${item.amount.toFixed(2)} • {item.billingDay}
            {getOrdinalSuffix(item.billingDay)} of month
          </Text>
          <Text style={styles.subscriptionNext}>
            Next: {format(item.nextProcessing, 'MMM d, yyyy')}
          </Text>
        </View>
      </View>

      <View style={styles.subscriptionRight}>
        <Switch
          value={item.isActive}
          onValueChange={() => handleToggleActive(item)}
          trackColor={{
            false: themeColors.border,
            true: colors.primary.main,
          }}
          thumbColor="#FFFFFF"
        />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteSubscription(item)}
        >
          <Icon name="delete" size={20} color={colors.semantic.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const activeCount = subscriptions.filter((s) => s.isActive).length;
  const totalMonthly = subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <View style={styles.container}>
      {/* Stats Card */}
      {subscriptions.length > 0 && (
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${totalMonthly.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Per Month</Text>
          </View>
        </View>
      )}

      {/* Subscriptions List */}
      <FlatList
        data={subscriptions}
        keyExtractor={(item) => item.id}
        renderItem={renderSubscriptionItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="repeat" size={64} color={themeColors.textSecondary} />
            <Text style={styles.emptyTitle}>No Subscriptions</Text>
            <Text style={styles.emptySubtitle}>
              Add your recurring subscriptions to track them automatically
            </Text>
          </View>
        }
      />

      {/* Add Subscription Button */}
      <View style={styles.footer}>
        <Button
          title="Add Subscription"
          onPress={handleAddSubscription}
          leftIcon={<Icon name="plus" size={20} color="#FFF" />}
        />
      </View>
    </View>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: themeColors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...{
      shadowColor: themeColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.primary.main,
  },
  statLabel: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: themeColors.border,
    marginHorizontal: spacing.lg,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  subscriptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...{
      shadowColor: themeColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  subscriptionItemInactive: {
    opacity: 0.6,
  },
  subscriptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionInfo: {
    flex: 1,
    gap: 4,
  },
  subscriptionName: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  textInactive: {
    color: themeColors.textSecondary,
  },
  subscriptionDetails: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  subscriptionNext: {
    ...typography.caption,
    color: colors.primary.main,
    fontSize: 11,
  },
  subscriptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: themeColors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
});
