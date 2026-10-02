/**
 * Purpose: Goal Completion Celebratory Modal for Simplizum redesign.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import type { Goal } from '../../types/models';

interface GoalCompletionModalProps {
  goal: Goal | null;
  visible: boolean;
  onMarkComplete: () => void;
  onCreateNew: () => void;
  onClose: () => void;
}

export const GoalCompletionModal: React.FC<GoalCompletionModalProps> = ({
  goal,
  visible,
  onMarkComplete,
  onCreateNew,
  onClose,
}) => {
  const themeColors = useThemeColors();

  if (!goal) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                borderColor: themeColors.success,
                backgroundColor: `${themeColors.success}15`,
              },
            ]}
          >
            <Icon name="trophy" size={28} color={themeColors.success} />
          </View>

          <Text style={[styles.kicker, { color: themeColors.textMuted }]}>
            TARGET ACHIEVED
          </Text>

          <Text style={[styles.title, { color: themeColors.text }]}>
            {goal.name}
          </Text>

          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            Congratulations! You have reached 100% of your target savings for this goal.
          </Text>

          <View style={styles.buttonStack}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: themeColors.text },
              ]}
              onPress={() => {
                triggerHaptic('notificationSuccess');
                onMarkComplete();
              }}
            >
              <Text style={[styles.primaryButtonText, { color: themeColors.background }]}>
                MARK AS COMPLETED
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { borderColor: themeColors.border },
              ]}
              onPress={() => {
                triggerHaptic('selection');
                onCreateNew();
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: themeColors.text }]}>
                SET NEW GOAL
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  kicker: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.xl,
  },
  buttonStack: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
});
