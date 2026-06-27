/**
 * Purpose: Horizontal scrollable slider of dashboard cards with section header
 *
 * Inputs:
 *   - goalsCount (object): {active: number, completed: number}
 *   - debtsStats (object): {totalLent: number, totalBorrowed: number}
 *   - subscriptionsCount (number): Number of active subscriptions
 *   - categoriesCount (number): Total number of categories
 *   - recurringCount (number): Number of active recurring expenses
 *   - accountCurrency (string): Currency code for formatting
 *
 * Outputs:
 *   - Returns (JSX.Element): Horizontal scrollable list of dashboard cards with header
 *
 * Side effects:
 *   - Navigates to respective screens when View All buttons are pressed
 *   - Navigates to AllSectionsScreen when View All Sections button is pressed
 */

import React, { useMemo, useCallback, useState, useRef } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { MainStackParamList } from '../../types/navigation';
import { GoalsCard } from './GoalsCard';
import { DebtsCard } from './DebtsCard';
import { SubscriptionsCard } from './SubscriptionsCard';
import { CategoriesCard } from './CategoriesCard';
import { RecurringCard } from './RecurringCard';

type NavigationProp = StackNavigationProp<MainStackParamList>;

interface DashboardCardsGridProps {
  goalsCount: { active: number; completed: number };
  debtsStats: { totalLent: number; totalBorrowed: number };
  subscriptionsCount: number;
  categoriesCount: number;
  recurringCount: number;
  accountCurrency: string;
}

type CardItem = {
  id: string;
  type: 'goals' | 'debts' | 'subscriptions' | 'categories' | 'recurring';
};

export const DashboardCardsGrid: React.FC<DashboardCardsGridProps> = React.memo(({
  goalsCount,
  debtsStats,
  subscriptionsCount,
  categoriesCount,
  recurringCount,
  accountCurrency,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleGoalsPress = useCallback(() => {
    navigation.navigate('GoalsScreen');
  }, [navigation]);

  const handleDebtsPress = useCallback(() => {
    navigation.navigate('DebtsScreen');
  }, [navigation]);

  const handleSubscriptionsPress = useCallback(() => {
    navigation.navigate('SubscriptionsScreen');
  }, [navigation]);

  const handleCategoriesPress = useCallback(() => {
    navigation.navigate('CategoriesScreen');
  }, [navigation]);

  const handleRecurringPress = useCallback(() => {
    navigation.navigate('RecurringExpenses');
  }, [navigation]);

  const handleViewAllSections = useCallback(() => {
    navigation.navigate('AllSectionsScreen');
  }, [navigation]);

  const cards: CardItem[] = useMemo(() => [
    { id: 'goals', type: 'goals' },
    { id: 'debts', type: 'debts' },
    { id: 'subscriptions', type: 'subscriptions' },
    { id: 'recurring', type: 'recurring' },
    { id: 'categories', type: 'categories' },
  ], []);

  const renderCard = useCallback(({ item }: { item: CardItem }) => {
    switch (item.type) {
      case 'goals':
        return (
          <GoalsCard
            activeGoalsCount={goalsCount.active}
            completedGoalsCount={goalsCount.completed}
            onViewAll={handleGoalsPress}
          />
        );
      case 'debts':
        return (
          <DebtsCard
            totalLent={debtsStats.totalLent}
            totalBorrowed={debtsStats.totalBorrowed}
            accountCurrency={accountCurrency}
            onViewAll={handleDebtsPress}
          />
        );
      case 'subscriptions':
        return (
          <SubscriptionsCard
            activeSubscriptionsCount={subscriptionsCount}
            onViewAll={handleSubscriptionsPress}
          />
        );
      case 'categories':
        return (
          <CategoriesCard
            totalCategoriesCount={categoriesCount}
            onViewAll={handleCategoriesPress}
          />
        );
      case 'recurring':
        return (
          <RecurringCard
            activeRecurringCount={recurringCount}
            onViewAll={handleRecurringPress}
          />
        );
      default:
        return null;
    }
  }, [
    goalsCount,
    debtsStats,
    subscriptionsCount,
    categoriesCount,
    recurringCount,
    accountCurrency,
    handleGoalsPress,
    handleDebtsPress,
    handleSubscriptionsPress,
    handleCategoriesPress,
    handleRecurringPress,
  ]);

  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const cardWidth = 180 + spacing.md; // Card width + gap
    const index = Math.round(offsetX / cardWidth);
    setActiveIndex(index);
  }, []);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quick Access</Text>
        <TouchableOpacity
          onPress={handleViewAllSections}
          activeOpacity={0.7}
          style={styles.viewAllButton}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={themeColors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Cards List */}
      <FlatList
        horizontal
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={196} // Card width (180) + gap (16)
        decelerationRate="fast"
        removeClippedSubviews={true}
        maxToRenderPerBatch={4}
        windowSize={3}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      {/* Scroll Indicator Dots */}
      <View style={styles.dotsContainer}>
        {cards.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === activeIndex
                  ? themeColors.primary
                  : themeColors.isDark
                    ? 'rgba(255, 255, 255, 0.2)'
                    : 'rgba(0, 0, 0, 0.2)',
                width: index === activeIndex ? 24 : 6,
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
});

DashboardCardsGrid.displayName = 'DashboardCardsGrid';

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h4,
    fontSize: 18,
    fontWeight: '700',
    color: themeColors.text,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: themeColors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
