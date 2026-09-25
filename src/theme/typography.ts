// Base Typography System
const baseTypography = {
  // Font Families - undefined lets React Native use default system font
  // On Android, specifying 'System' with bold weights causes rendering issues
  fontFamily: {
    regular: undefined,
    medium: undefined,
    bold: undefined,
  },

  // Font Sizes (compact scale)
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 19,
    xxl: 22,
    xxxl: 30,
    huge: 44,
  },

  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// Text Styles
const textStyles = {
  // Headings
  h1: {
    fontSize: baseTypography.fontSize.xxxl,
    fontWeight: baseTypography.fontWeight.bold,
    lineHeight: Math.round(baseTypography.fontSize.xxxl * baseTypography.lineHeight.tight),
  },
  h2: {
    fontSize: baseTypography.fontSize.xxl,
    fontWeight: baseTypography.fontWeight.bold,
    lineHeight: Math.round(baseTypography.fontSize.xxl * baseTypography.lineHeight.tight),
  },
  h3: {
    fontSize: baseTypography.fontSize.xl,
    fontWeight: baseTypography.fontWeight.semiBold,
    lineHeight: Math.round(baseTypography.fontSize.xl * baseTypography.lineHeight.normal),
  },
  h4: {
    fontSize: baseTypography.fontSize.lg,
    fontWeight: baseTypography.fontWeight.semiBold,
    lineHeight: Math.round(baseTypography.fontSize.lg * baseTypography.lineHeight.normal),
  },

  // Body
  body: {
    fontSize: baseTypography.fontSize.md,
    fontWeight: baseTypography.fontWeight.regular,
    lineHeight: Math.round(baseTypography.fontSize.md * baseTypography.lineHeight.normal),
  },
  bodySmall: {
    fontSize: baseTypography.fontSize.sm,
    fontWeight: baseTypography.fontWeight.regular,
    lineHeight: Math.round(baseTypography.fontSize.sm * baseTypography.lineHeight.normal),
  },
  bodyLarge: {
    fontSize: baseTypography.fontSize.lg,
    fontWeight: baseTypography.fontWeight.regular,
    lineHeight: Math.round(baseTypography.fontSize.lg * baseTypography.lineHeight.normal),
  },

  // Special
  caption: {
    fontSize: baseTypography.fontSize.xs,
    fontWeight: baseTypography.fontWeight.regular,
    lineHeight: Math.round(baseTypography.fontSize.xs * baseTypography.lineHeight.normal),
  },
  overline: {
    fontSize: baseTypography.fontSize.xs,
    fontWeight: baseTypography.fontWeight.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    lineHeight: Math.round(baseTypography.fontSize.xs * baseTypography.lineHeight.normal),
  },
  button: {
    fontSize: baseTypography.fontSize.md,
    fontWeight: baseTypography.fontWeight.semiBold,
    textTransform: 'uppercase' as const,
    lineHeight: Math.round(baseTypography.fontSize.md * baseTypography.lineHeight.normal),
  },

  // Numbers / Currency
  balanceHuge: {
    fontSize: baseTypography.fontSize.huge,
    fontWeight: baseTypography.fontWeight.bold,
    lineHeight: Math.round(baseTypography.fontSize.huge * baseTypography.lineHeight.tight),
  },
  balanceLarge: {
    fontSize: baseTypography.fontSize.xxxl,
    fontWeight: baseTypography.fontWeight.bold,
    lineHeight: Math.round(baseTypography.fontSize.xxxl * baseTypography.lineHeight.tight),
  },
  amountMedium: {
    fontSize: baseTypography.fontSize.xl,
    fontWeight: baseTypography.fontWeight.semiBold,
    lineHeight: Math.round(baseTypography.fontSize.xl * baseTypography.lineHeight.normal),
  },
};

// Export merged typography with both base values and text styles
export const typography = {
  ...baseTypography,
  ...textStyles,
};
