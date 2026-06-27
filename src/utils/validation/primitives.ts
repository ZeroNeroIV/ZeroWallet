// Shared validation primitives — single source of truth for all validation logic
// Used by both form validators (string errors) and AI validation (typed errors)

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function isValidDateString(value: string): boolean {
  return !isNaN(new Date(value).getTime());
}

export function parseDateString(value: string): number | null {
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.getTime();
}

export function isStringLengthBetween(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

export function isBillingDay(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

export function isInEnum<T>(value: unknown, validValues: readonly T[]): value is T {
  return validValues.includes(value as T);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validatePositiveNumber(value: unknown, fieldName: string): ValidationResult {
  if (!isPositiveNumber(value)) {
    return { valid: false, message: `${fieldName} must be a positive number` };
  }
  return { valid: true };
}

export function validateNonNegativeNumber(value: unknown, fieldName: string): ValidationResult {
  if (!isNonNegativeNumber(value)) {
    return { valid: false, message: `${fieldName} must be a non-negative number` };
  }
  return { valid: true };
}

export function validateStringLength(value: string, fieldName: string, min: number, max: number): ValidationResult {
  if (!isStringLengthBetween(value, min, max)) {
    return { valid: false, message: `${fieldName} must be between ${min} and ${max} characters` };
  }
  return { valid: true };
}

export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { valid: false, message: `${fieldName} is required` };
  }
  return { valid: true };
}
