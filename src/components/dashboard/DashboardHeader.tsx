/**
 * Purpose: Top header with dynamic greeting, user icon and notifications
 *
 * Inputs:
 *   - onNotificationsPress (function): Callback when notifications button is pressed
 *
 * Outputs:
 *   - Returns (JSX.Element): Dashboard header component with greeting
 *
 * Side effects:
 *   - Calls onNotificationsPress when notification bell is pressed
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../store/authStore';

interface DashboardHeaderProps {
  onQuickAccessPress: () => void;
  onRefreshPress?: () => void;
  isRefreshing?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = React.memo(({
  onQuickAccessPress,
  onRefreshPress,
  isRefreshing = false,
}) => {
  const themeColors = useThemeColors();
  const { top } = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(themeColors, top), [themeColors, top]);
  const currentUser = useAuthStore((state) => state.currentUser);

  // Get dynamic greeting based on UTC time
  const getGreeting = useMemo(() => {
    const hour = new Date().getUTCHours();

    if (hour >= 5 && hour < 12) {
      return 'Good Morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good Afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'Good Evening';
    } else {
      return 'Good Night';
    }
  }, []);

  const userName = currentUser?.name || 'User';

  return (
    <View style={styles.container}>
      {/* Left Section - Account Icon & Greeting */}
      <View style={styles.leftSection}>
        <View style={styles.accountIcon}>
          <MaterialCommunityIcons
            name="account-circle"
            size={40}
            color={themeColors.primary}
          />
        </View>

        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>{getGreeting}</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
      </View>

      {/* Action Buttons: Refresh & Quick Access */}
      <View style={styles.actions}>
        {onRefreshPress && (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onRefreshPress}
            activeOpacity={0.7}
            hitSlop={6}
            accessibilityLabel="Refresh dashboard data"
          >
            <MaterialCommunityIcons
              name="reload"
              size={22}
              color={themeColors.text}
            />
          </TouchableOpacity>
        )}

        {/* Quick Access Command Button */}
        <TouchableOpacity
          style={[styles.headerButton, styles.quickAccessButton]}
          onPress={onQuickAccessPress}
          activeOpacity={0.7}
          hitSlop={6}
          accessibilityLabel="Open Quick Access"
        >
          <MaterialCommunityIcons
            name="view-grid-outline"
            size={22}
            color={themeColors.onPrimary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

DashboardHeader.displayName = 'DashboardHeader';

const createStyles = (themeColors: ReturnType<typeof useThemeColors>, topInset: number) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: topInset + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: themeColors.background,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  accountIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '500',
    color: themeColors.textSecondary,
    marginBottom: 2,
  },
  userName: {
    ...typography.h4,
    fontSize: 18,
    fontWeight: '700',
    color: themeColors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: themeColors.surface,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  quickAccessButton: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
  },
});
