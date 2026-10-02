/**
 * Purpose: Provides dynamic theme colors based on current theme mode
 *
 * Inputs: None
 *
 * Outputs:
 *   - Returns object with theme-appropriate colors
 *
 * Side effects: None
 */

import { useTheme } from '../contexts/ThemeContext';
import { colors, lightTheme, darkTheme, brand, getSimplizumTheme } from '../theme/colors';

export const useThemeColors = () => {
  const { isDark, themeFamily } = useTheme();
  const activeTheme = getSimplizumTheme(themeFamily, isDark);

  return {
    // Brand tokens
    brand,
    chestnut: brand.chestnut,
    arctic: brand.arctic,
    gilded: brand.gilded,
    gold: brand.gilded,

    // Simplizum Active Theme Tokens
    simplizum: activeTheme,
    hairline: activeTheme.hairline,
    railBackground: activeTheme.railBackground,
    railBorder: activeTheme.railBorder,
    transfer: activeTheme.transfer,

    // Background & Surface colors
    background: activeTheme.background,
    surface: activeTheme.surface,
    surfaceElevated: activeTheme.card,
    surfaceHighlight: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
    card: activeTheme.card,
    cardBorder: activeTheme.hairline,

    // Text & Content colors
    text: activeTheme.text,
    textSecondary: activeTheme.textSecondary,
    textMuted: activeTheme.textMuted,
    textDisabled: isDark ? '#52525B' : '#A1A1AA',

    // Border colors
    border: activeTheme.border,
    borderSubtle: activeTheme.hairline,

    // Primary colors & contrast onPrimary
    primary: activeTheme.primary,
    primaryDark: activeTheme.primary,
    primaryLight: activeTheme.primary,
    onPrimary: activeTheme.onPrimary,

    // Secondary colors & contrast onSecondary
    secondary: activeTheme.secondary,
    secondaryDark: activeTheme.secondary,
    secondaryLight: activeTheme.secondary,
    onSecondary: activeTheme.onSecondary,

    // Surface / Background contrast
    onSurface: activeTheme.text,
    onBackground: activeTheme.text,

    // Accent colors
    accent: activeTheme.accent,
    accentDark: activeTheme.accent,
    accentLight: activeTheme.accent,

    // Semantic colors
    success: activeTheme.success,
    error: activeTheme.error,
    errorDark: activeTheme.error,
    warning: activeTheme.warning,
    info: activeTheme.info,

    // Vault colors
    vault: colors.vault,

    // Category colors
    category: colors.category,

    // Neutral colors
    neutral: colors.neutral,

    // Shadow colors
    shadow: colors.shadow,
    shadowLight: colors.shadowLight,
    shadowMedium: colors.shadowMedium,
    shadowDark: colors.shadowDark,

    // Glass morphism colors
    glass: {
      background: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)',
      border: activeTheme.hairline,
      borderLight: activeTheme.hairline,
    },

    // Goal/Debt colors
    goalGreen: activeTheme.success,
    debtRed: activeTheme.error,

    // Income/Expense colors (for transaction amounts)
    incomeGreen: activeTheme.success,
    expenseRed: activeTheme.error,

    // Theme object (for compatibility)
    theme: isDark ? darkTheme : lightTheme,

    // Helper flag
    isDark,
    themeFamily,
  };
};
