import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 24 * 2 - 12) / 2;
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Goal } from '../../types/models';
import type { MainStackParamList } from '../../types/navigation';

interface GoalsProgressCardProps {
  goals: Goal[];
}

const PROGRESS_COLORS = ['#4FC3F7', '#4DB6AC', '#FFB74D', '#CE93D8'];

export const GoalsProgressCard: React.FC<GoalsProgressCardProps> = ({ goals }) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation<StackNavigationProp<MainStackParamList>>();

  const displayed = goals.slice(0, 4);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Goals</Text>
      {displayed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>Set a goal and{'\n'}watch it grow!</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('CreateGoal', {})}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={14} color="#fff" />
            <Text style={styles.addBtnText}>Add Goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <View style={styles.list}>
        {displayed.map((goal, i) => {
          const target = goal.targetAmount ?? 1;
          const current = goal.currentAmount ?? 0;
          const pct = Math.min(100, Math.round((current / target) * 100));
          const color = PROGRESS_COLORS[i % PROGRESS_COLORS.length];
          return (
            <View key={goal.id} style={styles.goalRow}>
              <View style={styles.goalTop}>
                <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
                <Text style={[styles.goalPct, { color }]}>{pct}%</Text>
              </View>
              <View style={styles.trackBg}>
                <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>
      )}
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: themeColors.glass.background,
      borderRadius: 16,
      padding: spacing.md,
      width: CARD_WIDTH,
      overflow: 'hidden',
    },
    title: {
      ...typography.bodyLarge,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: spacing.md,
    },
    list: {
      gap: spacing.md,
    },
    goalRow: {
      gap: 6,
    },
    goalTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    goalName: {
      ...typography.bodySmall,
      fontWeight: '600',
      color: themeColors.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    goalPct: {
      ...typography.bodySmall,
      fontWeight: '700',
    },
    trackBg: {
      height: 6,
      borderRadius: 3,
      backgroundColor: themeColors.border,
      overflow: 'hidden',
    },
    trackFill: {
      height: 6,
      borderRadius: 3,
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    emptyIcon: {
      fontSize: 28,
    },
    emptyText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.sm,
      backgroundColor: themeColors.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: 12,
    },
    addBtnText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
  });
