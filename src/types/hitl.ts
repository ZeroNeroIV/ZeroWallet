/**
 * HITL (Human-In-The-Loop) Approval Types
 *
 * Used for user-confirmed execution of automated recurring items:
 * - Recurring expenses
 * - Subscriptions
 * - Auto-salary deposits
 */

export type HitlItemType = 'salary' | 'subscription' | 'recurring_expense';

export type DelayUnit = 'minutes' | 'days' | 'weeks' | 'months' | 'years';

export interface HitlApprovalItem {
  id: string;
  type: HitlItemType;
  entityId: string;
  name: string;
  amount: number;
  currency: string;
  vaultType: string;
  walletName?: string;
  accountId: string;
  categoryId?: string;
  categoryName?: string;
  dueDate: number;
  dateDescription: string;
  frequencyDescription?: string;
  originalItem: any;
}
