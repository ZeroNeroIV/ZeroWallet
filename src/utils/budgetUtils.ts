// Budget utilities - month-key helpers and progress formatting
import { format, addMonths, parse } from 'date-fns';

export const MONTH_KEY_FORMAT = 'yyyy-MM';

export const monthKeyFromDate = (date: Date): string => format(date, MONTH_KEY_FORMAT);

export const dateFromMonthKey = (month: string): Date => parse(month, MONTH_KEY_FORMAT, new Date());

export const shiftMonthKey = (month: string, delta: number): string =>
  monthKeyFromDate(addMonths(dateFromMonthKey(month), delta));

export const formatMonthLabel = (month: string): string =>
  format(dateFromMonthKey(month), 'MMMM yyyy');

/**
 * Color for a budget category's spend percentage.
 */
export const getBudgetStatusColor = (percentage: number): string => {
  if (percentage >= 100) return '#EF476F'; // over budget
  if (percentage >= 75) return '#FFD166'; // approaching limit
  return '#06D6A0'; // healthy
};
