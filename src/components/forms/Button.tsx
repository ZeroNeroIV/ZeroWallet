import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic } from '../../services/haptics/hapticFeedback';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode | string;
  rightIcon?: React.ReactNode | string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const isDisabled = disabled || loading;

  const handlePress = (event: any) => {
    lightHaptic();
    props.onPress?.(event);
  };

  const getIconColor = () => {
    switch (variant) {
      case 'primary':
        return themeColors.onPrimary;
      case 'secondary':
        return themeColors.onSecondary;
      case 'outline':
      case 'ghost':
      default:
        return themeColors.primary;
    }
  };

  const renderIcon = (icon: React.ReactNode | string | undefined) => {
    if (!icon) return null;
    
    // If it's a string, treat it as an icon name and render MaterialCommunityIcon
    if (typeof icon === 'string') {
      return (
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={getIconColor()}
        />
      );
    }
    
    // Otherwise, render as ReactNode
    return <>{icon}</>;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[variant],
        styles[size],
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
      onPress={handlePress}
    >
      {loading ? (
        <ActivityIndicator color={getIconColor()} />
      ) : (
        <>
          {renderIcon(leftIcon)}
          <Text style={[styles.text, styles[`${variant}Text`], textStyle]}>
            {title}
          </Text>
          {renderIcon(rightIcon)}
        </>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },

  // Variants
  primary: {
    backgroundColor: themeColors.primary,
  },
  secondary: {
    backgroundColor: themeColors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: themeColors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },

  // Sizes
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  medium: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  large: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },

  // Text
  text: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  primaryText: {
    color: themeColors.onPrimary,
  },
  secondaryText: {
    color: themeColors.onSecondary,
  },
  outlineText: {
    color: themeColors.primary,
  },
  ghostText: {
    color: themeColors.primary,
  },

  // States
  disabled: {
    opacity: 0.5,
  },
});
