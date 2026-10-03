/**
 * Purpose: Process subscriptions based on scheduled billing dates on app open
 * 
 * Strategy:
 *   - On app open, check all active subscriptions
 *   - If current date >= nextProcessing date, process the subscription
 *   - Handle multiple missed months automatically
 *   - Update nextProcessing date after processing
 */

import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { VaultType } from '../../domain/vault/VaultType';
import { useAccountStore } from '../../store/accountStore';

/**
 * Purpose: Calculate next billing date based on billing day
 * 
 * Inputs:
 *   - billingDay (number): Day of month (1-31)
 *   - fromDate (Date): Starting date for calculation
 * 
 * Outputs:
 *   - Returns (number): Unix timestamp of next billing date
 * 
 * Side effects: None
 */
export function calculateNextBillingDate(billingDay: number, fromDate: Date = new Date()): number {
  const nextDate = new Date(fromDate);
  nextDate.setMonth(nextDate.getMonth() + 1);
  nextDate.setDate(billingDay);
  
  // Handle edge case: billing day doesn't exist in target month (e.g., Feb 31st)
  if (nextDate.getDate() !== billingDay) {
    nextDate.setDate(0); // Go to last day of previous month
  }
  
  return nextDate.getTime();
}

/**
 * Purpose: Calculate how many billing cycles have been missed
 * 
 * Inputs:
 *   - nextProcessing (number): Unix timestamp of next scheduled billing
 *   - currentDate (Date): Current date
 * 
 * Outputs:
 *   - Returns (number): Number of billing cycles missed (0 if not due yet)
 * 
 * Side effects: None
 */
function calculateMissedBillingCycles(nextProcessing: number, currentDate: Date = new Date()): number {
  const processingDate = new Date(nextProcessing);
  
  if (currentDate < processingDate) {
    return 0;
  }
  
  const months = (currentDate.getFullYear() - processingDate.getFullYear()) * 12 
    + (currentDate.getMonth() - processingDate.getMonth()) + 1;
  
  return Math.max(0, months);
}

/**
 * Purpose: Check and process all due subscriptions on app open
 * 
 * Outputs:
 *   - Returns (Promise<{processed: number, totalAmount: number}>): Processing results
 * 
 * Side effects:
 *   - Creates expense transactions for due subscriptions
 *   - Updates vault balances
 *   - Updates nextProcessing dates
 */
export async function checkAndProcessSubscriptions(accountId: string): Promise<{ 
  processed: number; 
  totalAmount: number;
  subscriptions: Array<{name: string, amount: number, cycles: number}>;
}> {
  console.log('[SubscriptionTask] Checking subscriptions via HITL queue...');
  const { checkAndPromptHitlTasks } = await import('../hitl/hitlService');
  await checkAndPromptHitlTasks(accountId);
  return { processed: 0, totalAmount: 0, subscriptions: [] };
}

/**
 * Purpose: Get formatted text showing next billing date
 * 
 * Inputs:
 *   - nextProcessing (number): Unix timestamp of next processing
 * 
 * Outputs:
 *   - Returns (string): Formatted date string
 * 
 * Side effects: None
 */
export function getNextBillingDate(nextProcessing: number): string {
  const date = new Date(nextProcessing);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
