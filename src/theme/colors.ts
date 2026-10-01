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
