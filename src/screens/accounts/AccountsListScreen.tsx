// Accounts List Screen - Shows all accounts for the current user
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { MainStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import type { Account } from '../../types/models';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Button } from '../../components/forms/Button';
import { useThemeColors } from '../../hooks/useThemeColors';

type AccountsListNavigationProp = StackNavigationProp<
  MainStackParamList,
  'AccountsList'
>;

export default function AccountsListScreen() {
  const navigation = useNavigation<AccountsListNavigationProp>();
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentAccountId = useAuthStore((state) => state.currentAccountId);
  const switchAccount = useAuthStore((state) => state.switchAccount);
  const getAccountBalance = useAccountStore((state) => state.getAccountBalance);
  const themeColors = useThemeColors();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [animateOut, setAnimateOut] = useState(0);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const loadAccounts = async () => {
    if (!currentUser) return;

    try {
      const accountRepo = new AccountRepository();
      const userAccounts = await accountRepo.findByUser(currentUser.id);
      setAccounts(userAccounts);
    } catch (error) {
      console.error('[AccountsList] Failed to load accounts:', error);
      Alert.alert('Error', 'Failed to load accounts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setAnimateOut(prev => prev + 1);
      loadAccounts();
    }, [currentUser?.id])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadAccounts();
  };

  const handleSwitchAccount = (accountId: string) => {
    if (accountId === currentAccountId) return;

    Alert.alert(
      'Switch Account',
      'Are you sure you want to switch to this account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: () => {
            switchAccount(accountId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const renderAccount = ({ item }: { item: Account }) => {
    const isCurrent = item.id === currentAccountId;
    const balance = getAccountBalance(item.id);

    return (
      <Animated.View
        style={[styles.accountCard, isCurrent && styles.accountCardActive, { opacity: animateOut % 2 === 0 ? 1 : 0.9 }]}
      >
        <TouchableOpacity
          style={styles.accountTouchable}
          onPress={() => handleSwitchAccount(item.id)}
          activeOpacity={0.7}
        >
          <View
            style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}
          >
            <Icon name={item.icon} size={32} color={item.color} />
          </View>

          <View style={styles.accountInfo}>
            <View style={styles.accountHeader}>
              <Text style={styles.accountName}>{item.name}</Text>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
            </View>

            <Text style={styles.currency}>{item.currency}</Text>

            {balance && (
              <Text style={styles.balance}>
                {item.currency === 'USD' ? '$' : item.currency}{' '}
                {balance.totalBalance.toFixed(2)}
              </Text>
            )}
          </View>

          <Icon
            name={isCurrent ? 'check-circle' : 'chevron-right'}
            size={24}
            color={isCurrent ? colors.semantic.success : themeColors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('AccountSettings', { accountId: item.id })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="cog-outline" size={22} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading accounts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={accounts}
        renderItem={renderAccount}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="wallet-outline" size={64} color={themeColors.textSecondary} />
            <Text style={styles.emptyText}>No accounts found</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Button
          title="Create New Account"
          onPress={() => navigation.navigate('CreateAccount')}
          leftIcon={<Icon name="plus" size={20} color={themeColors.surface} />}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  accountCardActive: {
    borderColor: colors.semantic.success,
    backgroundColor: colors.semantic.successLight,
    marginHorizontal: -4,
    paddingHorizontal: spacing.md + 4,
  },
  accountTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  accountInfo: {
    flex: 1,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  accountName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold,
    color: themeColors.text,
    marginRight: spacing.sm,
  },
  currentBadge: {
    backgroundColor: colors.semantic.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  currentBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: themeColors.surface,
  },
  currency: {
    fontSize: typography.fontSize.sm,
    color: themeColors.textSecondary,
    marginBottom: spacing.xs,
  },
  balance: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: themeColors.text,
  },
  settingsButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    color: themeColors.textSecondary,
    marginTop: spacing.md,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: themeColors.surface,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
});
