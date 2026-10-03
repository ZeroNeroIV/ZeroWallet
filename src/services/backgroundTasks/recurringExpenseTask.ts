/**
 * Purpose: Process recurring expenses based on scheduled occurrence dates on app open
 * 
 * Strategy:
 *   - On app open, check all active recurring expenses
 *   - If current date >= nextOccurrence date, process the expense
 *   - Only auto-process expenses with autoDeduct enabled
 *   - Handle multiple missed occurrences automatically
 *   - Update nextOccurrence date after processing
 */

import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { VaultType } from '../../domain/vault/VaultType';
import { useAccountStore } from '../../store/accountStore';
import type { RecurringFrequency } from '../../types/models';

/**
 * Purpose: Calculate next occurrence date based on frequency and interval
 * 
 * Inputs:
 *   - frequency (RecurringFrequency): daily, weekly, monthly, or yearly
 *   - interval (number): Every X days/weeks/months/years
 *   - fromDate (Date): Starting date for calculation
 * 
 * Outputs:
 *   - Returns (number): Unix timestamp of next occurrence
 * 
 * Side effects: None
 */
export function calculateNextOccurrence(
  frequency: RecurringFrequency,
  interval: number,
  fromDate: Date = new Date()
): number {
  const nextDate = new Date(fromDate);

  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + interval * 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      break;
  }

  return nextDate.getTime();
}

/**
 * Purpose: Calculate how many occurrences have been missed
 * 
 * Inputs:
 *   - nextOccurrence (number): Unix timestamp of next scheduled occurrence
 *   - frequency (RecurringFrequency): Frequency type
 *   - interval (number): Interval between occurrences
 *   - currentDate (Date): Current date
 * 
 * Outputs:
 *   - Returns (number): Number of occurrences missed (0 if not due yet)
 * 
 * Side effects: None
 */
function calculateMissedOccurrences(
  nextOccurrence: number, 
  frequency: RecurringFrequency,
  interval: number,
  currentDate: Date = new Date()
): number {
  const occurrenceDate = new Date(nextOccurrence);
  
  if (currentDate < occurrenceDate) {
    return 0;
  }
  
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((currentDate.getTime() - occurrenceDate.getTime()) / msPerDay);
  
  let occurrences = 0;
  
  switch (frequency) {
    case 'daily':
      occurrences = Math.floor(daysDiff / interval) + 1;
      break;
    case 'weekly':
      occurrences = Math.floor(daysDiff / (interval * 7)) + 1;
      break;
    case 'monthly':
      const monthsDiff = (currentDate.getFullYear() - occurrenceDate.getFullYear()) * 12 
        + (currentDate.getMonth() - occurrenceDate.getMonth());
      occurrences = Math.floor(monthsDiff / interval) + 1;
      break;
    case 'yearly':
      const yearsDiff = currentDate.getFullYear() - occurrenceDate.getFullYear();
      occurrences = Math.floor(yearsDiff / interval) + 1;
      break;
  }
  
  return Math.max(0, occurrences);
}

/**
 * Purpose: Check and process all due recurring expenses on app open
 * 
 * Outputs:
 *   - Returns (Promise<{processed: number, totalAmount: number}>): Processing results
 * 
 * Side effects:
 *   - Creates expense transactions for due auto-deduct recurring expenses
 *   - Updates vault balances
 *   - Updates nextOccurrence dates
 */
export async function checkAndProcessRecurringExpenses(accountId: string): Promise<{ 
  processed: number; 
  totalAmount: number;
  expenses: Array<{name: string, amount: number, occurrences: number}>;
}> {
  console.log('[RecurringExpenseTask] Checking recurring expenses via HITL queue...');
  const { checkAndPromptHitlTasks } = await import('../hitl/hitlService');
  await checkAndPromptHitlTasks(accountId);
  return { processed: 0, totalAmount: 0, expenses: [] };
}

/**
 * Purpose: Get formatted text showing next occurrence date
 * 
 * Inputs:
 *   - nextOccurrence (number): Unix timestamp of next occurrence
 * 
 * Outputs:
 *   - Returns (string): Formatted date string
 * 
 * Side effects: None
 */
export function getNextOccurrenceDate(nextOccurrence: number): string {
  const date = new Date(nextOccurrence);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
