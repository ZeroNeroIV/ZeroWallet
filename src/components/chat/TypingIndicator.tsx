/**
 * TypingIndicator — Simplizum Architectural Edition
 *
 * Minimalist indicator showing AI reasoning / dispatch cycle
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';

interface TypingIndicatorProps {
  isVisible: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isVisible }) => {
  const themeColors = useThemeColors();
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.cell}>
        <View style={styles.cellHeader}>
          <Text style={styles.superText}>LAYA SYSTEM ROUTER</Text>
        </View>
        <View style={styles.contentRow}>
          <ActivityIndicator size="small" color={themeColors.text} style={styles.spinner} />
          <Text style={styles.bodyText}>Synthesizing financial context & reasoning...</Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      alignItems: 'flex-start',
    },
    cell: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderLeftWidth: 2,
      borderLeftColor: theme.text,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    cellHeader: {
      marginBottom: 3,
    },
    superText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      fontFamily: 'monospace',
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
    },
    spinner: {
      transform: [{ scale: 0.75 }],
    },
    bodyText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 12,
    },
  });
