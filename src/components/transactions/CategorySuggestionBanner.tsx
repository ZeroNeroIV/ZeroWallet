/**
 * Purpose: Display an AI category suggestion with confidence and on-demand creation
 *
 * Inputs:
 *   - suggestion (CategorizationOutcome | null): model choice with confidence score
 *   - loading (boolean): suggestion in progress
 *   - onApplyMatch (categoryId): apply the matched existing category
 *   - onCreateNew (): create the proposed category on demand and apply it
 *   - onDismiss (): hide the banner
 *
 * Outputs:
 *   - Returns (JSX.Element | null): suggestion banner or nothing
 *
 * Side effects: None
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { CategorizationOutcome } from '../../types/categorization';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

interface CategorySuggestionBannerProps {
  suggestion: CategorizationOutcome | null;
  loading: boolean;
  creating: boolean;
  onApplyMatch: (categoryId: string) => void;
  onCreateNew: () => void;
  onDismiss: () => void;
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High confidence';
  if (confidence >= 0.55) return 'Medium confidence';
  return 'Low confidence';
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#06D6A0';
  if (confidence >= 0.55) return '#FFD166';
  return '#FF8B94';
}

export const CategorySuggestionBanner: React.FC<CategorySuggestionBannerProps> = ({
  suggestion,
  loading,
  creating,
  onApplyMatch,
  onCreateNew,
  onDismiss,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={themeColors.primary} />
        <Text style={styles.loadingText}>Laya is finding the best category…</Text>
      </View>
    );
  }

  if (!suggestion) return null;

  const busy = creating;
  const confidence = suggestion.choice.confidence;
  const pct = Math.round(confidence * 100);

  if (suggestion.kind === 'create_new') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Icon name="sparkles" size={18} color={themeColors.primary} />
          <Text style={styles.title}>New category suggested</Text>
          <TouchableOpacity style={styles.dismiss} onPress={onDismiss} disabled={busy}>
            <Icon name="close" size={18} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.body}>
          No good match for this expense. Laya suggests creating{' '}
          <Text style={styles.bold}>“{suggestion.newCategory.name}”</Text> instead of using Other.
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.dot, { backgroundColor: suggestion.newCategory.color }]} />
          <Text style={styles.metaText}>
            {confidenceLabel(confidence)} · {pct}% · {suggestion.source}
          </Text>
        </View>
        {suggestion.choice.reasoning ? (
          <Text style={styles.reasoning}>{suggestion.choice.reasoning}</Text>
        ) : null}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.buttonDisabled]}
            onPress={onCreateNew}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.primaryText}>Create “{suggestion.newCategory.name}”</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={onDismiss} disabled={busy}>
            <Text style={styles.ghostText}>Keep manual</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="sparkles" size={18} color={themeColors.primary} />
        <Text style={styles.title}>Suggested: {suggestion.choice.categoryName}</Text>
        <TouchableOpacity style={styles.dismiss} onPress={onDismiss} disabled={busy}>
          <Icon name="close" size={18} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.metaRow}>
        <View style={[styles.dot, { backgroundColor: confidenceColor(confidence) }]} />
        <Text style={styles.metaText}>
          {confidenceLabel(confidence)} · {pct}% · {suggestion.source}
        </Text>
      </View>
      {suggestion.choice.reasoning ? (
        <Text style={styles.reasoning}>{suggestion.choice.reasoning}</Text>
      ) : null}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, busy && styles.buttonDisabled]}
          onPress={() => suggestion.choice.categoryId && onApplyMatch(suggestion.choice.categoryId)}
          disabled={busy || !suggestion.choice.categoryId}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryText}>Apply {suggestion.choice.categoryName}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButton} onPress={onDismiss} disabled={busy}>
          <Text style={styles.ghostText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.primary + '40',
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    title: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
      flex: 1,
    },
    dismiss: {
      padding: spacing.xs,
    },
    body: {
      ...typography.body,
      color: themeColors.text,
      marginBottom: spacing.xs,
    },
    bold: {
      fontWeight: '700',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    metaText: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    reasoning: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontStyle: 'italic',
      marginBottom: spacing.sm,
    },
    loadingText: {
      ...typography.body,
      color: themeColors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: themeColors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    primaryText: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFF',
    },
    ghostButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostText: {
      ...typography.body,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
  });
