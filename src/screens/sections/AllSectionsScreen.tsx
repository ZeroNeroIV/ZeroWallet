/**
 * Purpose: Central hub to access all finance management sections
 *
 * Inputs: None
 *
 * Outputs:
 *   - Returns (JSX.Element): Screen with list of all sections
 *
 * Side effects:
 *   - Navigates to respective screens when section cards are pressed
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { MainStackParamList } from '../../types/navigation';

type NavigationProp = StackNavigationProp<MainStackParamList>;

interface SectionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  route: keyof MainStackParamList;
}

export const AllSectionsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const sections: SectionItem[] = useMemo(() => [
    {
      id: 'wallets',
      title: 'Wallets',
      description: 'Add, rename and organize wallets',
      icon: 'wallet-outline',
      iconColor: themeColors.primary,
      route: 'Wallets',
    },
    {
      id: 'recurring',
      title: 'Recurring',
      description: 'Subscriptions and repeating expenses',
      icon: 'refresh-circle',
      iconColor: '#f59e0b',
      route: 'Recurring',
    },
    {
      id: 'goals',
      title: 'Goals',
      description: 'Manage your financial goals',
      icon: 'flag-checkered',
      iconColor: themeColors.goalGreen,
      route: 'GoalsScreen',
    },
    {
      id: 'debts',
      title: 'Debts',
      description: 'Track money lent & borrowed',
      icon: 'hand-coin-outline',
      iconColor: themeColors.debtRed,
      route: 'DebtsScreen',
    },
    {
      id: 'categories',
      title: 'Categories',
      description: 'Organize transactions',
      icon: 'tag-multiple',
      iconColor: '#8b5cf6',
      route: 'CategoriesScreen',
    },
  ], [themeColors]);

  const handleSectionPress = useCallback((route: keyof MainStackParamList) => {
    navigation.navigate(route);
  }, [navigation]);

  const renderSectionItem = useCallback(({ item }: { item: SectionItem }) => (
    <TouchableOpacity
      style={styles.sectionCard}
      onPress={() => handleSectionPress(item.route)}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: item.iconColor + '20' }]}>
        <MaterialCommunityIcons
          name={item.icon as any}
          size={24}
          color={item.iconColor}
        />
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text style={styles.sectionTitle}>{item.title}</Text>
        <Text style={styles.sectionDescription}>{item.description}</Text>
      </View>

      {/* Chevron */}
      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={themeColors.isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
      />
    </TouchableOpacity>
  ), [styles, themeColors, handleSectionPress]);

  return (
    <View style={styles.container}>
      <FlatList
        data={sections}
        renderItem={renderSectionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Quick Access</Text>
            <Text style={styles.headerSubtitle}>
              Everything in your wallet, one tap away
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default AllSectionsScreen;

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    marginBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: themeColors.text,
  },
  headerSubtitle: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.glass.background,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: themeColors.glass.borderLight,
    gap: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.h4,
    fontSize: 16,
    fontWeight: '700',
    color: themeColors.text,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: themeColors.isDark
      ? 'rgba(255, 255, 255, 0.5)'
      : 'rgba(0, 0, 0, 0.5)',
  },
});
