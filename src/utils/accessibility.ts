/**
 * Purpose: Provides accessibility utilities and helpers
 * 
 * Inputs: Various accessibility properties
 * 
 * Outputs: Accessibility prop objects
 * 
 * Side effects: None (pure functions)
 */

import { AccessibilityRole } from 'react-native';

/**
 * Purpose: Generate accessibility props for buttons
 */
export const buttonAccessibility = (label: string, hint?: string) => ({
  accessible: true,
  accessibilityRole: 'button' as AccessibilityRole,
  accessibilityLabel: label,
  accessibilityHint: hint,
});

/**
 * Purpose: Generate accessibility props for text inputs
 */
export const inputAccessibility = (label: string, value?: string, hint?: string) => ({
  accessible: true,
  accessibilityRole: 'text' as AccessibilityRole,
  accessibilityLabel: label,
  accessibilityValue: value ? { text: value } : undefined,
  accessibilityHint: hint,
});

/**
 * Purpose: Generate accessibility props for switches/toggles
 */
export const switchAccessibility = (label: string, checked: boolean, hint?: string) => ({
  accessible: true,
  accessibilityRole: 'switch' as AccessibilityRole,
  accessibilityLabel: label,
  accessibilityState: { checked },
  accessibilityHint: hint,
});

/**
 * Purpose: Generate accessibility props for headers
 */
export const headerAccessibility = (label: string) => ({
  accessible: true,
  accessibilityRole: 'header' as AccessibilityRole,
  accessibilityLabel: label,
});

/**
 * Purpose: Generate accessibility props for images
 */
export const imageAccessibility = (label: string) => ({
  accessible: true,
  accessibilityRole: 'image' as AccessibilityRole,
  accessibilityLabel: label,
});

/**
 * Purpose: Generate accessibility props for links
 */
export const linkAccessibility = (label: string, hint?: string) => ({
  accessible: true,
  accessibilityRole: 'link' as AccessibilityRole,
  accessibilityLabel: label,
  accessibilityHint: hint,
});

/**
 * Purpose: Generate accessibility props for list items
 */
export const listItemAccessibility = (label: string, index: number, total: number) => ({
  accessible: true,
  accessibilityLabel: `${label}. Item ${index + 1} of ${total}`,
});

/**
 * Purpose: Generate accessibility props for tabs
 */
export const tabAccessibility = (label: string, selected: boolean) => ({
  accessible: true,
  accessibilityRole: 'tab' as AccessibilityRole,
  accessibilityLabel: label,
  accessibilityState: { selected },
});

/**
 * Purpose: Format currency for screen readers
 */
export const formatCurrencyForAccessibility = (amount: number, isIncome: boolean = false) => {
  const prefix = isIncome ? 'Income' : 'Expense';
  const formattedAmount = Math.abs(amount).toFixed(3);
  return `${prefix} of ${formattedAmount} dollars`;
};

/**
 * Purpose: Format date for screen readers
 */
export const formatDateForAccessibility = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Purpose: Announce important changes to screen readers
 */
export const announceForAccessibility = (message: string) => {
  // This would use AccessibilityInfo.announceForAccessibility in React Native
  // Placeholder for now
  console.log('[A11Y] Announce:', message);
};

/**
 * Purpose: Generate accessibility label for transaction item
 */
export const transactionAccessibility = (
  categoryName: string,
  amount: number,
  type: 'income' | 'expense',
  date: string,
  description?: string
) => {
  const amountLabel = formatCurrencyForAccessibility(amount, type === 'income');
  const dateLabel = formatDateForAccessibility(date);
  const descLabel = description ? `. ${description}` : '';
  
  return {
    accessible: true,
    accessibilityLabel: `${categoryName}. ${amountLabel}. ${dateLabel}${descLabel}`,
    accessibilityHint: 'Double tap to view details, swipe for actions',
  };
};

/**
 * Purpose: Generate accessibility label for vault card
 */
export const vaultAccessibility = (
  vaultName: string,
  balance: number,
  percentage: number
) => ({
  accessible: true,
  accessibilityLabel: `${vaultName} vault. Balance: ${balance.toFixed(3)} dollars. ${percentage.toFixed(0)} percent of total`,
  accessibilityHint: 'Double tap to manage this vault',
});

/**
 * Purpose: Reduce motion for animations
 */
export const shouldReduceMotion = (): boolean => {
  // This would use AccessibilityInfo.isReduceMotionEnabled() in production
  // For now, return false
  return false;
};

export default {
  button: buttonAccessibility,
  input: inputAccessibility,
  switch: switchAccessibility,
  header: headerAccessibility,
  image: imageAccessibility,
  link: linkAccessibility,
  listItem: listItemAccessibility,
  tab: tabAccessibility,
  formatCurrency: formatCurrencyForAccessibility,
  formatDate: formatDateForAccessibility,
  announce: announceForAccessibility,
  transaction: transactionAccessibility,
  vault: vaultAccessibility,
  shouldReduceMotion,
};
