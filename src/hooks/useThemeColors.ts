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
import { colors, lightTheme, darkTheme, brand } from '../theme/colors';

export const useThemeColors = () => {
  const { isDark } = useTheme();

  return {
    // Brand tokens
    brand,
    chestnut: brand.chestnut,
    arctic: brand.arctic,
    gilded: brand.gilded,
    gold: brand.gilded,

    // Background colors
    background: isDark ? brand.espresso : brand.creamAlabaster,
    surface: isDark ? brand.espressoSurface : brand.pureWhite,

    // Text colors
    text: isDark ? '#FDFBFA' : brand.chestnut,
    textSecondary: isDark ? brand.arctic : '#6B5857',
    textDisabled: isDark ? '#7A6B6A' : colors.textDisabled,

    // Border colors
    border: isDark ? brand.espressoBorder : 'rgba(195, 218, 232, 0.6)',

    // Primary colors
    primary: isDark ? brand.gilded : brand.chestnut,
    primaryDark: isDark ? '#E5D69F' : '#2D1E1D',
    primaryLight: isDark ? '#FFF7D6' : '#5E4341',

    // Secondary colors
    secondary: isDark ? brand.arctic : brand.gilded,
    secondaryDark: isDark ? '#A2C2D4' : '#E5D69F',
    secondaryLight: isDark ? '#E0EEF7' : '#FFF9DE',

    // Accent colors
    accent: isDark ? brand.gilded : brand.arctic,
    accentDark: isDark ? '#E5D69F' : '#9EBECF',
    accentLight: isDark ? '#FFF7D6' : '#E0EFF7',

    // Semantic colors
    success: colors.semantic.success,
    error: colors.semantic.error,
    errorDark: colors.semantic.errorDark,
    warning: colors.semantic.warning,
    info: colors.semantic.info,

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
    glass: colors.glass,

    // Goal/Debt colors
    goalGreen: colors.semantic.goalGreen,
    debtRed: colors.semantic.debtRed,

    // Income/Expense colors (for transaction amounts)
    incomeGreen: colors.semantic.success, // Bright green that works in both light and dark
    expenseRed: colors.semantic.error, // Bright red that works in both light and dark

    // Theme object (for compatibility)
    theme: isDark ? darkTheme : lightTheme,

    // Helper flag
    isDark,
  };
};
