// Form Validation Utilities — wraps shared primitives with string-error return pattern
import { validateRequired as req, isNonEmptyString, isValidEmail } from './validation/primitives';

export function validateEmail(email: string): string | null {
  if (!isNonEmptyString(email)) return 'Email is required';
  if (!isValidEmail(email)) return 'Please enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!isNonEmptyString(password)) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function validateName(name: string): string | null {
  if (!isNonEmptyString(name)) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return null;
}

export function validateAmount(amount: string): string | null {
  if (!isNonEmptyString(amount)) return 'Amount is required';
  const num = parseFloat(amount);
  if (isNaN(num)) return 'Please enter a valid amount';
  if (num <= 0) return 'Amount must be greater than 0';
  return null;
}

export function validateRequired(value: string, fieldName: string): string | null {
  const result = req(value, fieldName);
  return result.valid ? null : result.message ?? null;
}
