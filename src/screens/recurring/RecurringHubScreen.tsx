/**
 * Purpose: Recurring hub — subscriptions and recurring expenses in one place
 *
 * Inputs:
 *   - route.params.tab ('subscriptions' | 'recurring', optional): Initial tab
 *
 * Outputs:
 *   - Returns (JSX.Element): Tabbed hub reusing both existing screens
 *
 * Side effects:
 *   - Switches tabs locally; inner screens navigate as before
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import SubscriptionsScreen from '../subscriptions/SubscriptionsScreen';
import RecurringExpensesScreen from '../recurring/RecurringExpensesScreen';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { MainStackParamList } from '../../types/navigation';

type RecurringRouteProp = RouteProp<MainStackParamList, 'Recurring'>;
type Tab = 'subscriptions' | 'recurring';

export default function RecurringHubScreen({ route }: { route: RecurringRouteProp }) {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'subscriptions');

  const renderTab = (value: Tab, label: string, icon: string) => {
    const active = tab === value;
    return (
      <TouchableOpacity
        style={[styles.tab, active && styles.tabActive]}
        onPress={() => setTab(value)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={18}
          color={active ? '#fff' : themeColors.textSecondary}
        />
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {renderTab('subscriptions', 'Subscriptions', 'refresh-circle')}
        {renderTab('recurring', 'Recurring', 'repeat')}
      </View>
      <View style={styles.content}>
        {tab === 'subscriptions' ? <SubscriptionsScreen /> : <RecurringExpensesScreen />}
      </View>
    </View>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.md,
      padding: 4,
      gap: 4,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.sm,
      gap: spacing.xs,
    },
    tabActive: {
      backgroundColor: themeColors.primary,
    },
    tabText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    tabTextActive: {
      color: '#fff',
    },
    content: {
      flex: 1,
      marginTop: spacing.sm,
    },
  });
