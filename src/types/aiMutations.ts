/**
 * Purpose: Type definitions for AI-initiated CRUD operations
 *
 * Inputs: None (type definitions only)
 *
 * Outputs:
 *   - Exports types for mutations, pending actions, and results
 *
 * Side effects: None
 */

import type { VaultType } from './models';

// ============================================================================
// Core Types
// ============================================================================

export type MutationType = 'create' | 'update' | 'delete';

export type EntityType =
  | 'transaction'
  | 'goal'
  | 'debt'
  | 'subscription'
  | 'recurringExpense'
  | 'category';

// ============================================================================
// Pending Action
// ============================================================================

export type PendingActionStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface PendingAction {
  id: string;
  type: MutationType;
  entityType: EntityType;
  functionName: string;
  parameters: Record<string, any>;
  resolvedData: Record<string, any>;
  summary: string;
  createdAt: number;
  expiresAt: number;
  status: PendingActionStatus;
}

export interface ActionResult {
  success: boolean;
  actionId: string;
  entityType: EntityType;
  entityId?: string;
  error?: string;
  auditLogId?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export enum AIOperationErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CATEGORY_RESOLUTION_FAILED = 'CATEGORY_RESOLUTION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  ACTION_EXPIRED = 'ACTION_EXPIRED',
  ACTION_CANCELLED = 'ACTION_CANCELLED',
  ACTION_NOT_FOUND = 'ACTION_NOT_FOUND',
  DUPLICATE_ENTITY = 'DUPLICATE_ENTITY',
  REFERENCE_CONSTRAINT = 'REFERENCE_CONSTRAINT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export class AIOperationError extends Error {
  type: AIOperationErrorType;
  details: Record<string, any>;
  userMessage: string;

  constructor(
    type: AIOperationErrorType,
    message: string,
    userMessage: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AIOperationError';
    this.type = type;
    this.userMessage = userMessage;
    this.details = details || {};
  }
}

// ============================================================================
// Audit Log
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  accountId: string;
  action: MutationType;
  entityType: EntityType;
  entityId: string | null;
  functionName: string;
  initiator: 'ai_assistant';
  conversationId?: string;
  parameters: Record<string, any>;
  result: 'success' | 'failure';
  resultData?: Record<string, any>;
  errorMessage?: string;
  previousState?: Record<string, any>;
}

// ============================================================================
// Transaction Mutation Types
// ============================================================================

export interface CreateTransactionParams {
  type: 'income' | 'expense';
  amount: number;
  categoryName: string;
  description?: string;
  date?: string;
  vaultType?: VaultType;
}

export interface UpdateTransactionParams {
  transactionId: string;
  amount?: number;
  categoryName?: string;
  description?: string;
  date?: string;
  vaultType?: VaultType;
}

export interface DeleteTransactionParams {
  transactionId: string;
  reason?: string;
}

// ============================================================================
// Goal Mutation Types
// ============================================================================

export interface CreateGoalParams {
  name: string;
  targetAmount: number;
  fundingSource?: 'main' | 'savings' | 'both';
  icon?: string;
  color?: string;
}

export interface UpdateGoalParams {
  goalId: string;
  name?: string;
  targetAmount?: number;
  fundingSource?: 'main' | 'savings' | 'both';
  icon?: string;
  color?: string;
}

export interface UpdateGoalProgressParams {
  goalId: string;
  currentAmount: number;
}

export interface CompleteGoalParams {
  goalId: string;
}

export interface DeleteGoalParams {
  goalId: string;
  reason?: string;
}

// ============================================================================
// Debt Mutation Types
// ============================================================================

export interface CreateDebtParams {
  type: 'lent' | 'borrowed';
  personName: string;
  amount: number;
  dueDate?: string;
  description?: string;
}

export interface UpdateDebtParams {
  debtId: string;
  personName?: string;
  amount?: number;
  dueDate?: string;
  description?: string;
}

export interface RecordDebtPaymentParams {
  debtId: string;
  paymentAmount: number;
}

export interface MarkDebtAsPaidParams {
  debtId: string;
}

export interface DeleteDebtParams {
  debtId: string;
  reason?: string;
}

// ============================================================================
// Subscription Mutation Types
// ============================================================================

export interface CreateSubscriptionParams {
  name: string;
  amount: number;
  categoryName: string;
  billingDay: number;
  vaultType?: VaultType;
}

export interface UpdateSubscriptionParams {
  subscriptionId: string;
  name?: string;
  amount?: number;
  categoryName?: string;
  billingDay?: number;
  isActive?: boolean;
  vaultType?: VaultType;
}

export interface ToggleSubscriptionParams {
  subscriptionId: string;
  isActive: boolean;
}

export interface DeleteSubscriptionParams {
  subscriptionId: string;
  reason?: string;
}

// ============================================================================
// Recurring Expense Mutation Types
// ============================================================================

export interface CreateRecurringExpenseParams {
  name: string;
  amount: number;
  categoryName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  startDate: string;
  vaultType?: VaultType;
  autoDeduct?: boolean;
}

export interface UpdateRecurringExpenseParams {
  recurringExpenseId: string;
  name?: string;
  amount?: number;
  categoryName?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  isActive?: boolean;
  vaultType?: VaultType;
  autoDeduct?: boolean;
}

export interface DeleteRecurringExpenseParams {
  recurringExpenseId: string;
  reason?: string;
}

// ============================================================================
// Category Mutation Types
// ============================================================================

export interface CreateCategoryParams {
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

export interface UpdateCategoryParams {
  categoryId: string;
  name?: string;
  icon?: string;
  color?: string;
}

export interface DeleteCategoryParams {
  categoryId: string;
}

// ============================================================================
// Validated Input Types (after validation, with resolved IDs)
// ============================================================================

export interface ValidatedTransactionInput {
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  categoryName: string;
  description: string;
  date: number;
  vaultType: VaultType;
}

export interface ValidatedGoalInput {
  name: string;
  targetAmount: number;
  fundingSource: 'main' | 'savings' | 'both';
  icon: string;
  color: string;
}

export interface ValidatedDebtInput {
  type: 'lent' | 'borrowed';
  personName: string;
  amount: number;
  dueDate: number | null;
  description: string;
}

export interface ValidatedSubscriptionInput {
  name: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  billingDay: number;
  vaultType: VaultType;
}

export interface ValidatedRecurringExpenseInput {
  name: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  nextOccurrence: number;
  vaultType: VaultType;
  autoDeduct: boolean;
}

export interface ValidatedCategoryInput {
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}

// ============================================================================
// Function Names Constants
// ============================================================================

export const WRITE_FUNCTION_NAMES = {
  // Transactions
  CREATE_TRANSACTION: 'createTransaction',
  UPDATE_TRANSACTION: 'updateTransaction',
  DELETE_TRANSACTION: 'deleteTransaction',

  // Goals
  CREATE_GOAL: 'createGoal',
  UPDATE_GOAL: 'updateGoal',
  UPDATE_GOAL_PROGRESS: 'updateGoalProgress',
  COMPLETE_GOAL: 'completeGoal',
  DELETE_GOAL: 'deleteGoal',

  // Debts
  CREATE_DEBT: 'createDebt',
  UPDATE_DEBT: 'updateDebt',
  RECORD_DEBT_PAYMENT: 'recordDebtPayment',
  MARK_DEBT_AS_PAID: 'markDebtAsPaid',
  DELETE_DEBT: 'deleteDebt',

  // Subscriptions
  CREATE_SUBSCRIPTION: 'createSubscription',
  UPDATE_SUBSCRIPTION: 'updateSubscription',
  TOGGLE_SUBSCRIPTION: 'toggleSubscription',
  DELETE_SUBSCRIPTION: 'deleteSubscription',

  // Recurring Expenses
  CREATE_RECURRING_EXPENSE: 'createRecurringExpense',
  UPDATE_RECURRING_EXPENSE: 'updateRecurringExpense',
  DELETE_RECURRING_EXPENSE: 'deleteRecurringExpense',

  // Categories
  CREATE_CATEGORY: 'createCategory',
  UPDATE_CATEGORY: 'updateCategory',
  DELETE_CATEGORY: 'deleteCategory',
} as const;

export type WriteFunctionName =
  (typeof WRITE_FUNCTION_NAMES)[keyof typeof WRITE_FUNCTION_NAMES];

// Helper to check if a function name is a write function
export const isWriteFunction = (functionName: string): boolean => {
  return Object.values(WRITE_FUNCTION_NAMES).includes(
    functionName as WriteFunctionName
  );
};

// ============================================================================
// Constants
// ============================================================================

export const PENDING_ACTION_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_WRITE_OPERATIONS_PER_MINUTE = 10;

// Default values for optional fields
export const DEFAULT_VAULT_TYPE = 'main' as const;
export const DEFAULT_FUNDING_SOURCE = 'savings' as const;
export const DEFAULT_ICON = 'help-circle' as const;
export const DEFAULT_COLOR = '#6366F1' as const;
