/**
 * Purpose: Model selection component for choosing Gemini AI model
 *
 * Inputs:
 *   - selectedModel (GeminiModel): Currently selected model ID
 *   - onSelectModel (function): Callback when user selects a model
 *
 * Outputs:
 *   - Returns (JSX.Element): Model picker with cards and token explanation
 *
 * Side effects:
 *   - Triggers haptic feedback on model selection
 *   - Expands/collapses token explanation section
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { GEMINI_MODELS, TOKENS_EXPLANATION } from '../../constants/geminiModels';
import type { GeminiModel } from '../../types/ai';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';

interface ModelPickerProps {
  selectedModel: GeminiModel;
  onSelectModel: (modelId: GeminiModel) => void;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  selectedModel,
  onSelectModel,
}) => {
  const themeColors = useThemeColors();
  const [showTokensExplanation, setShowTokensExplanation] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Handle model selection
  const handleSelectModel = useCallback(
    (modelId: GeminiModel) => {
      mediumHaptic();
      onSelectModel(modelId);
    },
    [onSelectModel]
  );

  // Toggle tokens explanation
  const handleToggleExplanation = useCallback(() => {
    lightHaptic();
    setShowTokensExplanation((prev) => !prev);
  }, []);

  // Render speed badge
  const renderSpeedBadge = (speed: number) => {
    const speedIcons = Array(3)
      .fill(0)
      .map((_, index) => (
        <MaterialCommunityIcons
          key={index}
          name="lightning-bolt"
          size={14}
          color={index < speed ? themeColors.warning : themeColors.textSecondary}
          style={{ marginLeft: index > 0 ? -2 : 0 }}
        />
      ));
    return <View style={styles.badgeRow}>{speedIcons}</View>;
  };

  // Render accuracy badge
  const renderAccuracyBadge = (accuracy: number) => {
    const accuracyIcons = Array(4)
      .fill(0)
      .map((_, index) => (
        <MaterialCommunityIcons
          key={index}
          name="star"
          size={14}
          color={index < accuracy ? themeColors.warning : themeColors.textSecondary}
          style={{ marginLeft: index > 0 ? -2 : 0 }}
        />
      ));
    return <View style={styles.badgeRow}>{accuracyIcons}</View>;
  };

  return (
    <View style={styles.container}>
      {/* Model Cards */}
      {GEMINI_MODELS.map((model) => {
        const isSelected = model.id === selectedModel;

        return (
          <TouchableOpacity
            key={model.id}
            style={[
              styles.modelCard,
              isSelected && styles.modelCardSelected,
            ]}
            onPress={() => handleSelectModel(model.id)}
            activeOpacity={0.7}
          >
            {/* Radio Button & Name Row */}
            <View style={styles.headerRow}>
              <View style={styles.radioButton}>
                {isSelected && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={[styles.modelName, isSelected && styles.modelNameSelected]}>
                {model.name}
              </Text>
              {model.recommended && (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>Recommended</Text>
                </View>
              )}
            </View>

            {/* Description */}
            <Text style={styles.modelDescription}>{model.description}</Text>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Speed:</Text>
                {renderSpeedBadge(model.speed)}
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Accuracy:</Text>
                {renderAccuracyBadge(model.accuracy)}
              </View>
            </View>

            {/* Tokens Info */}
            <Text style={styles.tokensInfo}>
              Max output: {(model.maxOutputTokens / 1000).toFixed(0)}K tokens
            </Text>

            {/* Best For */}
            <View style={styles.bestForContainer}>
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={themeColors.success}
              />
              <Text style={styles.bestForText}>{model.bestFor}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* What are tokens? Expandable Section */}
      <TouchableOpacity
        style={styles.tokensButton}
        onPress={handleToggleExplanation}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={20}
          color={themeColors.primary}
        />
        <Text style={styles.tokensButtonText}>What are tokens?</Text>
        <MaterialCommunityIcons
          name={showTokensExplanation ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={themeColors.textSecondary}
        />
      </TouchableOpacity>

      {/* Tokens Explanation Panel */}
      {showTokensExplanation && (
        <View style={styles.explanationPanel}>
          <Text style={styles.explanationText}>{TOKENS_EXPLANATION}</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },

    // Model Card
    modelCard: {
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 2,
      borderColor: themeColors.border,
    },
    modelCardSelected: {
      borderColor: themeColors.primary,
      backgroundColor: themeColors.isDark
        ? themeColors.surface
        : `${themeColors.primary}15`, // 15% opacity
    },

    // Header Row (Radio + Name + Badge)
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: themeColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    radioButtonInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: themeColors.primary,
    },
    modelName: {
      ...typography.h4,
      color: themeColors.text,
      flex: 1,
    },
    modelNameSelected: {
      color: themeColors.primary,
      fontWeight: typography.fontWeight.bold,
    },
    recommendedBadge: {
      backgroundColor: themeColors.success,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
      borderRadius: borderRadius.sm,
    },
    recommendedText: {
      ...typography.caption,
      color: themeColors.neutral.white,
      fontWeight: typography.fontWeight.semiBold,
    },

    // Description
    modelDescription: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      marginBottom: spacing.sm,
    },

    // Stats Row
    statsRow: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    statLabel: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      fontWeight: typography.fontWeight.medium,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    // Tokens Info
    tokensInfo: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginBottom: spacing.xs,
    },

    // Best For
    bestForContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    bestForText: {
      ...typography.bodySmall,
      color: themeColors.text,
      fontWeight: typography.fontWeight.medium,
      flex: 1,
    },

    // Tokens Button
    tokensButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginTop: spacing.sm,
    },
    tokensButtonText: {
      ...typography.body,
      color: themeColors.primary,
      fontWeight: typography.fontWeight.medium,
      flex: 1,
    },

    // Explanation Panel
    explanationPanel: {
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    explanationText: {
      ...typography.bodySmall,
      color: themeColors.text,
      lineHeight: 20,
    },
  });
