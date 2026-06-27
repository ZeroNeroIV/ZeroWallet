// Declarative function registry for Gemini function calling
// Each entry maps 1:1 to a Gemini function_declaration object
import type { WriteFunctionName } from '../../types/aiMutations';

export interface FunctionParamProperty {
  type: string;
  description: string;
  enum?: readonly string[];
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, FunctionParamProperty>;
    required?: readonly string[];
  };
}

export interface FunctionRegistryEntry extends FunctionDefinition {
  kind: 'read' | 'write';
  handlerName: string;
}

// ============================================================
// READ FUNCTIONS  (executed immediately, no confirmation)
// ============================================================

const READ_FUNCTIONS: FunctionRegistryEntry[] = [
  {
    name: 'getRecentTransactions',
    description: 'Get recent transactions (max 10)',
    kind: 'read',
    handlerName: 'getRecentTransactions',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of transactions to retrieve (1-10)' },
        type: { type: 'string', enum: ['income', 'expense'] as const, description: 'Filter by transaction type' },
      },
    },
  },
  {
    name: 'getMonthlyStats',
    description: 'Get income/expense statistics for a specific month',
    kind: 'read',
    handlerName: 'getMonthlyStats',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Year (e.g., 2026)' },
        month: { type: 'number', description: 'Month (1-12)' },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'getCategoryBreakdown',
    description: 'Get spending/income breakdown by category for a date range',
    kind: 'read',
    handlerName: 'getCategoryBreakdown',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in ISO format (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date in ISO format (YYYY-MM-DD)' },
        type: { type: 'string', enum: ['income', 'expense'] as const, description: 'Type of transactions to analyze' },
      },
      required: ['startDate', 'endDate', 'type'],
    },
  },
  {
    name: 'getAccountBalance',
    description: 'Get current account balance across all vaults',
    kind: 'read',
    handlerName: 'getAccountBalance',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getActiveGoals',
    description: 'Get all active savings goals',
    kind: 'read',
    handlerName: 'getActiveGoals',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getDebtStats',
    description: 'Get lending/borrowing statistics and active debts',
    kind: 'read',
    handlerName: 'getDebtStats',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getActiveSubscriptions',
    description: 'Get all active monthly subscriptions',
    kind: 'read',
    handlerName: 'getActiveSubscriptions',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getRecurringExpenses',
    description: 'Get all scheduled recurring expenses',
    kind: 'read',
    handlerName: 'getRecurringExpenses',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================
// WRITE FUNCTIONS  (require user confirmation)
// ============================================================

const WRITE_FUNCTIONS: FunctionRegistryEntry[] = [
  // ── Transactions ──────────────────────────────────────────
  {
    name: 'createTransaction',
    description: 'Create a new income or expense transaction. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'createTransactionAction',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'] as const, description: 'Transaction type' },
        amount: { type: 'number', description: 'Transaction amount (positive number)' },
        categoryName: { type: 'string', description: 'Category name (will be resolved to category ID)' },
        description: { type: 'string', description: 'Optional description or notes' },
        date: { type: 'string', description: 'Optional date in YYYY-MM-DD format (defaults to today)' },
        vaultType: { type: 'string', enum: ['main', 'savings', 'held'] as const, description: 'Which vault to affect (defaults to main)' },
      },
      required: ['type', 'amount', 'categoryName'],
    },
  },
  {
    name: 'updateTransaction',
    description: 'Update an existing transaction. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'updateTransactionAction',
    parameters: {
      type: 'object',
      properties: {
        transactionId: { type: 'string', description: 'ID of transaction to update' },
        amount: { type: 'number', description: 'New amount' },
        categoryName: { type: 'string', description: 'New category name' },
        description: { type: 'string', description: 'New description' },
        date: { type: 'string', description: 'New date (YYYY-MM-DD)' },
        vaultType: { type: 'string', enum: ['main', 'savings', 'held'] as const, description: 'New vault type' },
      },
      required: ['transactionId'],
    },
  },
  {
    name: 'deleteTransaction',
    description: 'Delete a transaction. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'deleteTransactionAction',
    parameters: {
      type: 'object',
      properties: {
        transactionId: { type: 'string', description: 'ID of transaction to delete' },
        reason: { type: 'string', description: 'Optional reason for deletion' },
      },
      required: ['transactionId'],
    },
  },

  // ── Goals ─────────────────────────────────────────────────
  {
    name: 'createGoal',
    description: 'Create a new savings goal. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'createGoalAction',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Goal name' },
        targetAmount: { type: 'number', description: 'Target amount to save' },
        fundingSource: { type: 'string', enum: ['main', 'savings', 'both'] as const, description: 'Which vaults fund this goal (defaults to savings)' },
        icon: { type: 'string', description: 'Optional icon name' },
        color: { type: 'string', description: 'Optional hex color' },
      },
      required: ['name', 'targetAmount'],
    },
  },
  {
    name: 'updateGoal',
    description: 'Update a goal. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'updateGoalAction',
    parameters: {
      type: 'object',
      properties: {
        goalId: { type: 'string', description: 'ID of goal to update' },
        name: { type: 'string', description: 'New name' },
        targetAmount: { type: 'number', description: 'New target amount' },
        fundingSource: { type: 'string', enum: ['main', 'savings', 'both'] as const, description: 'New funding source' },
      },
      required: ['goalId'],
    },
  },
  {
    name: 'updateGoalProgress',
    description: 'Update the current amount saved for a goal. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'updateGoalProgressAction',
    parameters: {
      type: 'object',
      properties: {
        goalId: { type: 'string', description: 'ID of goal' },
        currentAmount: { type: 'number', description: 'New current amount' },
      },
      required: ['goalId', 'currentAmount'],
    },
  },
  {
    name: 'completeGoal',
    description: 'Mark a goal as completed. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'completeGoalAction',
    parameters: {
      type: 'object',
      properties: {
        goalId: { type: 'string', description: 'ID of goal to complete' },
      },
      required: ['goalId'],
    },
  },
  {
    name: 'deleteGoal',
    description: 'Delete a goal. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'deleteGoalAction',
    parameters: {
      type: 'object',
      properties: {
        goalId: { type: 'string', description: 'ID of goal to delete' },
        reason: { type: 'string', description: 'Optional reason' },
      },
      required: ['goalId'],
    },
  },

  // ── Debts ─────────────────────────────────────────────────
  {
    name: 'createDebt',
    description: 'Record money lent or borrowed. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'createDebtAction',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['lent', 'borrowed'] as const, description: 'lent = money owed to me, borrowed = money I owe' },
        personName: { type: 'string', description: 'Name of person' },
        amount: { type: 'number', description: 'Amount' },
        dueDate: { type: 'string', description: 'Optional due date (YYYY-MM-DD)' },
        description: { type: 'string', description: 'Optional description' },
      },
      required: ['type', 'personName', 'amount'],
    },
  },
  {
    name: 'updateDebt',
    description: 'Update debt details. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'updateDebtAction',
    parameters: {
      type: 'object',
      properties: {
        debtId: { type: 'string', description: 'ID of debt' },
        personName: { type: 'string', description: 'New person name' },
        amount: { type: 'number', description: 'New amount' },
        dueDate: { type: 'string', description: 'New due date (YYYY-MM-DD)' },
        description: { type: 'string', description: 'New description' },
      },
      required: ['debtId'],
    },
  },
  {
    name: 'recordDebtPayment',
    description: 'Record a payment toward a debt. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'recordDebtPaymentAction',
    parameters: {
      type: 'object',
      properties: {
        debtId: { type: 'string', description: 'ID of debt' },
        paymentAmount: { type: 'number', description: 'Payment amount' },
      },
      required: ['debtId', 'paymentAmount'],
    },
  },
  {
    name: 'markDebtAsPaid',
    description: 'Mark a debt as fully paid/settled. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'markDebtAsPaidAction',
    parameters: {
      type: 'object',
      properties: {
        debtId: { type: 'string', description: 'ID of debt' },
      },
      required: ['debtId'],
    },
  },
  {
    name: 'deleteDebt',
    description: 'Delete a debt record. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'deleteDebtAction',
    parameters: {
      type: 'object',
      properties: {
        debtId: { type: 'string', description: 'ID of debt to delete' },
        reason: { type: 'string', description: 'Optional reason' },
      },
      required: ['debtId'],
    },
  },

  // ── Subscriptions ─────────────────────────────────────────
  {
    name: 'createSubscription',
    description: 'Add a new monthly subscription. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'createSubscriptionAction',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Subscription name' },
        amount: { type: 'number', description: 'Monthly amount' },
        categoryName: { type: 'string', description: 'Category name' },
        billingDay: { type: 'number', description: 'Day of month for billing (1-31)' },
        vaultType: { type: 'string', enum: ['main', 'savings', 'held'] as const, description: 'Which vault to deduct from (defaults to main)' },
      },
      required: ['name', 'amount', 'categoryName', 'billingDay'],
    },
  },
  {
    name: 'updateSubscription',
    description: 'Update subscription details. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'updateSubscriptionAction',
    parameters: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'ID of subscription' },
        name: { type: 'string', description: 'New name' },
        amount: { type: 'number', description: 'New amount' },
        categoryName: { type: 'string', description: 'New category' },
        billingDay: { type: 'number', description: 'New billing day (1-31)' },
        isActive: { type: 'boolean', description: 'Active status' },
      },
      required: ['subscriptionId'],
    },
  },
  {
    name: 'toggleSubscription',
    description: 'Activate or deactivate a subscription. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'toggleSubscriptionAction',
    parameters: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'ID of subscription' },
        isActive: { type: 'boolean', description: 'New active status' },
      },
      required: ['subscriptionId', 'isActive'],
    },
  },
  {
    name: 'deleteSubscription',
    description: 'Remove a subscription. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'deleteSubscriptionAction',
    parameters: {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'ID of subscription to delete' },
        reason: { type: 'string', description: 'Optional reason' },
      },
      required: ['subscriptionId'],
    },
  },

  // ── Recurring Expenses ────────────────────────────────────
  {
    name: 'createRecurringExpense',
    description: 'Add a new recurring expense. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'createRecurringExpenseAction',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Expense name' },
        amount: { type: 'number', description: 'Amount per occurrence' },
        categoryName: { type: 'string', description: 'Category name' },
        frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'] as const, description: 'How often it recurs' },
        interval: { type: 'number', description: 'Every X frequency units (e.g., interval=2, frequency=weekly = every 2 weeks)' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        vaultType: { type: 'string', enum: ['main', 'savings', 'held'] as const, description: 'Which vault to deduct from' },
        autoDeduct: { type: 'boolean', description: 'Auto-create transaction on occurrence' },
      },
      required: ['name', 'amount', 'categoryName', 'frequency', 'interval', 'startDate'],
    },
  },
  {
    name: 'updateRecurringExpense',
    description: 'Update recurring expense details. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'updateRecurringExpenseAction',
    parameters: {
      type: 'object',
      properties: {
        recurringExpenseId: { type: 'string', description: 'ID of recurring expense' },
        name: { type: 'string', description: 'New name' },
        amount: { type: 'number', description: 'New amount' },
        categoryName: { type: 'string', description: 'New category' },
        frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'] as const, description: 'New frequency' },
        interval: { type: 'number', description: 'New interval' },
        isActive: { type: 'boolean', description: 'Active status' },
      },
      required: ['recurringExpenseId'],
    },
  },
  {
    name: 'deleteRecurringExpense',
    description: 'Remove a recurring expense. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'deleteRecurringExpenseAction',
    parameters: {
      type: 'object',
      properties: {
        recurringExpenseId: { type: 'string', description: 'ID of recurring expense to delete' },
        reason: { type: 'string', description: 'Optional reason' },
      },
      required: ['recurringExpenseId'],
    },
  },

  // ── Categories ────────────────────────────────────────────
  {
    name: 'createCategory',
    description: 'Create a new custom category. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'createCategoryAction',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Category name' },
        type: { type: 'string', enum: ['income', 'expense'] as const, description: 'Category type' },
        icon: { type: 'string', description: 'Optional icon name' },
        color: { type: 'string', description: 'Optional hex color' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'updateCategory',
    description: 'Update category details. REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'updateCategoryAction',
    parameters: {
      type: 'object',
      properties: {
        categoryId: { type: 'string', description: 'ID of category' },
        name: { type: 'string', description: 'New name' },
        icon: { type: 'string', description: 'New icon' },
        color: { type: 'string', description: 'New color' },
      },
      required: ['categoryId'],
    },
  },
  {
    name: 'deleteCategory',
    description: 'Delete a custom category (cannot delete default categories). REQUIRES USER CONFIRMATION.',
    kind: 'write',
    handlerName: 'deleteCategoryAction',
    parameters: {
      type: 'object',
      properties: {
        categoryId: { type: 'string', description: 'ID of category to delete' },
      },
      required: ['categoryId'],
    },
  },
];

// ============================================================
// Combined exports
// ============================================================

export const ALL_FUNCTIONS: readonly FunctionRegistryEntry[] = [
  ...READ_FUNCTIONS,
  ...WRITE_FUNCTIONS,
];

export const FUNCTION_DEFINITIONS: readonly FunctionDefinition[] = ALL_FUNCTIONS.map(
  ({ kind: _kind, handlerName: _handlerName, ...def }) => def,
);

/** Quick lookup: function name → metadata */
export const FUNCTION_BY_NAME = new Map<string, FunctionRegistryEntry>(
  ALL_FUNCTIONS.map((f) => [f.name, f]),
);

/** Quick lookup: write function name → handler name */
export const WRITE_HANDLER_MAP = new Map<string, string>(
  WRITE_FUNCTIONS.map((f) => [f.name, f.handlerName]),
);

/** Quick lookup: read function name → handler name */
export const READ_HANDLER_MAP = new Map<string, string>(
  READ_FUNCTIONS.map((f) => [f.name, f.handlerName]),
);

export const READ_FUNCTION_NAMES = new Set<string>(
  READ_FUNCTIONS.map((f) => f.name),
);

export const WRITE_FUNCTION_NAMES_SET = new Set<string>(
  WRITE_FUNCTIONS.map((f) => f.name),
);
