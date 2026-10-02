// Brand Palette: Chestnut Hollow, Arctic Whisper, and Gilded Nectar
export const brand = {
  chestnut: '#432F2E',
  arctic: '#C3DAE8',
  gilded: '#FEEFB6',
  espresso: '#150F0E',
  espressoSurface: '#241918',
  espressoBorder: '#432F2E',
  creamAlabaster: '#FBF8F4',
  pureWhite: '#FFFFFF',
};

// Color Palette with nested structure
export const colors = {
  // Primary Colors
  primary: {
    main: '#432F2E',
    dark: '#2D1E1D',
    light: '#5E4341',
  },

  // Secondary Colors
  secondary: {
    main: '#FEEFB6',
    dark: '#E5D69F',
    light: '#FFF9DE',
  },

  // Accent Colors
  accent: {
    main: '#C3DAE8',
    dark: '#9EBECF',
    light: '#E0EFF7',
  },

  // Semantic Colors
  semantic: {
    success: '#06D6A0',
    successDark: '#05B886',
    successLight: '#35E0B4',
    error: '#EF476F',
    errorDark: '#D63459',
    errorLight: '#F37091',
    warning: '#FFD166',
    warningDark: '#F5BB4D',
    warningLight: '#FFDC8F',
    info: '#118AB2',
    infoDark: '#0D6E8C',
    infoLight: '#3FA3C4',
    goalGreen: '#10b981',
    debtRed: '#ff4d4d',
  },

  // Neutral Colors
  neutral: {
    white: '#FFFFFF',
    black: '#000000',
    gray50: '#FAFAFA',
    gray100: '#F5F5F5',
    gray200: '#EEEEEE',
    gray300: '#E0E0E0',
    gray400: '#BDBDBD',
    gray500: '#9E9E9E',
    gray600: '#757575',
    gray700: '#616161',
    gray800: '#424242',
    gray900: '#212121',
  },

  // Vault Colors
  vault: {
    main: '#432F2E',
    savings: '#FEEFB6',
    held: '#FF6B6B',
  },

  // Glass Morphism Colors
  glass: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(195, 218, 232, 0.2)',
    borderLight: 'rgba(195, 218, 232, 0.35)',
  },

  // Background
  background: '#FBF8F4',
  backgroundDark: '#150F0E',
  surface: '#FFFFFF',
  surfaceDark: '#241918',

  // Text
  text: '#432F2E',
  textSecondary: '#6B5857',
  textDisabled: '#BDBDBD',
  textDark: '#FDFBFA',
  textSecondaryDark: '#C3DAE8',

  // Category Default Colors
  category: {
    red: '#FF6B6B',
    blue: '#4ECDC4',
    yellow: '#FFE66D',
    green: '#A8E6CF',
    pink: '#FF8B94',
    purple: '#B4A7D6',
    skyBlue: '#89CFF0',
    lavender: '#C7CEEA',
    teal: '#06D6A0',
    navy: '#118AB2',
    orange: '#FFD166',
    fuchsia: '#EF476F',
    indigo: '#26547C',
  },

  // Borders
  border: 'rgba(195, 218, 232, 0.6)',
  borderDark: '#432F2E',

  // Shadows
  shadow: 'rgba(0, 0, 0, 0.2)',
  shadowLight: 'rgba(0, 0, 0, 0.1)',
  shadowMedium: 'rgba(0, 0, 0, 0.2)',
  shadowDark: 'rgba(0, 0, 0, 0.3)',
};

// Light Theme
export const lightTheme = {
  primary: brand.chestnut,
  background: brand.creamAlabaster,
  surface: brand.pureWhite,
  text: brand.chestnut,
  textSecondary: '#6B5857',
  border: 'rgba(195, 218, 232, 0.6)',
  success: colors.semantic.success,
  error: colors.semantic.error,
  warning: colors.semantic.warning,
  info: colors.semantic.info,
};

// Dark Theme
export const darkTheme = {
  primary: brand.gilded,
  background: brand.espresso,
  surface: brand.espressoSurface,
  text: '#FDFBFA',
  textSecondary: brand.arctic,
  border: brand.espressoBorder,
  success: colors.semantic.success,
  error: colors.semantic.error,
  warning: colors.semantic.warning,
  info: colors.semantic.info,
};

// ============================================
// Simplizum Multi-Theme Families (Dual-Mode)
// ============================================

export type ThemeFamily = 'swiss' | 'nordic' | 'cyber';

export const swissLightTheme = {
  id: 'swiss-light',
  name: 'Swiss Monolith Light',
  isDark: false,
  background: '#FFFFFF',
  surface: '#FAFAFA',
  card: '#FFFFFF',
  hairline: '#E5E5E5',
  border: '#E5E5E5',
  text: '#0A0A0A',
  textSecondary: '#666666',
  textMuted: '#999999',
  primary: '#0A0A0A',
  onPrimary: '#FFFFFF',
  secondary: '#F4F4F5',
  onSecondary: '#0A0A0A',
  accent: '#0A0A0A',
  railBackground: 'rgba(255, 255, 255, 0.94)',
  railBorder: '#E5E5E5',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  transfer: '#4F46E5',
};

export const swissDarkTheme = {
  id: 'swiss-dark',
  name: 'Swiss Monolith Dark',
  isDark: true,
  background: '#09090B',
  surface: '#121215',
  card: '#09090B',
  hairline: '#27272A',
  border: '#27272A',
  text: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  primary: '#FAFAFA',
  onPrimary: '#09090B',
  secondary: '#18181B',
  onSecondary: '#FAFAFA',
  accent: '#FFFFFF',
  railBackground: 'rgba(9, 9, 11, 0.92)',
  railBorder: '#27272A',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  transfer: '#6366F1',
};

export const nordicLightTheme = {
  id: 'nordic-light',
  name: 'Nordic Titanium Light',
  isDark: false,
  background: '#F7F6F3',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  hairline: '#E2DFD8',
  border: '#E2DFD8',
  text: '#1C1B1A',
  textSecondary: '#6F6D66',
  textMuted: '#9C9990',
  primary: '#1C1B1A',
  onPrimary: '#F7F6F3',
  secondary: '#EFECE6',
  onSecondary: '#1C1B1A',
  accent: '#8C857B',
  railBackground: 'rgba(247, 246, 243, 0.94)',
  railBorder: '#E2DFD8',
  success: '#2E7D32',
  error: '#C62828',
  warning: '#D97706',
  info: '#1565C0',
  transfer: '#5C6BC0',
};

export const nordicDarkTheme = {
  id: 'nordic-dark',
  name: 'Nordic Titanium Dark',
  isDark: true,
  background: '#161614',
  surface: '#1E1D1B',
  card: '#161614',
  hairline: '#2C2B28',
  border: '#2C2B28',
  text: '#F0EFEA',
  textSecondary: '#A8A69E',
  textMuted: '#73716A',
  primary: '#F0EFEA',
  onPrimary: '#161614',
  secondary: '#232220',
  onSecondary: '#F0EFEA',
  accent: '#A39E93',
  railBackground: 'rgba(22, 22, 20, 0.92)',
  railBorder: '#2C2B28',
  success: '#4ADE80',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',
  transfer: '#818CF8',
};

export const cyberLightTheme = {
  id: 'cyber-light',
  name: 'Cyber Slate Light',
  isDark: false,
  background: '#F8FAFC',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  hairline: '#E2E8F0',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  primary: '#0F172A',
  onPrimary: '#F8FAFC',
  secondary: '#F1F5F9',
  onSecondary: '#0F172A',
  accent: '#475569',
  railBackground: 'rgba(248, 250, 252, 0.94)',
  railBorder: '#E2E8F0',
  success: '#10B981',
  error: '#F43F5E',
  warning: '#F59E0B',
  info: '#0EA5E9',
  transfer: '#6366F1',
};

export const cyberDarkTheme = {
  id: 'cyber-dark',
  name: 'Cyber Slate Dark',
  isDark: true,
  background: '#090D16',
  surface: '#111622',
  card: '#090D16',
  hairline: '#1E293B',
  border: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#F8FAFC',
  onPrimary: '#090D16',
  secondary: '#1A2234',
  onSecondary: '#F8FAFC',
  accent: '#94A3B8',
  railBackground: 'rgba(9, 13, 22, 0.92)',
  railBorder: '#1E293B',
  success: '#34D399',
  error: '#FB7185',
  warning: '#FBBF24',
  info: '#38BDF8',
  transfer: '#818CF8',
};

export function getSimplizumTheme(family: ThemeFamily = 'swiss', isDark: boolean) {
  if (family === 'nordic') {
    return isDark ? nordicDarkTheme : nordicLightTheme;
  }
  if (family === 'cyber') {
    return isDark ? cyberDarkTheme : cyberLightTheme;
  }
  return isDark ? swissDarkTheme : swissLightTheme;
}

// Compatibility helper - adds .main property to semantic colors
export const compatColors = {
  ...colors,
  success: {
    main: colors.semantic.success,
    dark: colors.semantic.successDark,
    light: colors.semantic.successLight,
  },
  error: {
    main: colors.semantic.error,
    dark: colors.semantic.errorDark,
    light: colors.semantic.errorLight,
  },
  warning: {
    main: colors.semantic.warning,
    dark: colors.semantic.warningDark,
    light: colors.semantic.warningLight,
  },
  info: {
    main: colors.semantic.info,
    dark: colors.semantic.infoDark,
    light: colors.semantic.infoLight,
  },
};
