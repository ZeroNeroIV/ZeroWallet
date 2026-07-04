// Core data models for the Money Tracking App

// ============================================
// User & Authentication
// ============================================

export interface User {
  id: string; // UUID
  email: string;
  passwordHash: string; // Hashed with crypto
  name: string;
  createdAt: number; // Unix timestamp
  updatedAt: number;
}

// ============================================
// Account & Balance
// ============================================

export interface Account {
  id: string; // UUID
  userId: string; // FK to User
  name: string;
  currency: string; // 'USD', 'EUR', etc.
  icon: string; // Icon name
  color: string; // Hex color
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

// Balance Model (MMKV only - fast access)
export interface AccountBalance {
  accountId: string;
  mainBalance: number; // Available spending money
  savingsBalance: number; // Savings vault
  heldBalance: number; // Third-party held money
  totalBalance: number; // Computed: main + savings + held
  availableBalance: number; // Computed: main + savings (excludes held)
  lastUpdated: number;
}

// ============================================
// Transactions
// ============================================

export type TransactionType = 'income' | 'expense';
export type VaultType = 'main' | 'savings' | 'held';

export interface Transaction {
  id: string; // UUID
  accountId: string; // FK to Account
  type: TransactionType;
  amount: number;
  categoryId: string; // FK to Category
  description: string;
  date: number; // Unix timestamp
  vaultType: VaultType; // Which vault affected
  isRecurring: boolean; // Flag for recurring transaction
  recurringExpenseId?: string; // FK to RecurringExpense (if applicable)
  subscriptionId?: string; // FK to Subscription (if applicable)
  imagePath?: string; // Path to attached receipt/proof image (legacy single image)
  images?: string[]; // Paths to all attached images
  currency: string; // Currency code (e.g., 'USD', 'EUR', 'JOD')
  originalAmount?: number; // Amount in original currency (if different)
  exchangeRate?: number; // Exchange rate used for conversion
  convertedAmount?: number; // Amount in account's base currency
  createdAt: number;
  updatedAt: number;
}

// Input type for creating transactions (without generated fields)
export type TransactionInput = Omit<
  Transaction,
  'id' | 'createdAt' | 'updatedAt' | 'isRecurring'
> & {
  isRecurring?: boolean;
  recurringExpenseId?: string;
  subscriptionId?: string;
};

// ============================================
// Categories
// ============================================

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string; // UUID
  userId: string; // FK to User (user-specific categories)
  name: string;
  type: CategoryType;
  icon: string; // Icon name from react-native-vector-icons
  color: string; // Hex color
  isDefault: boolean; // System default vs user-created
  createdAt: number;
}

export type CategoryInput = Omit<Category, 'id' | 'createdAt'>;

// ============================================
// Subscriptions
// ============================================

export interface Subscription {
  id: string; // UUID
  accountId: string; // FK to Account
  name: string;
  amount: number;
  categoryId: string; // FK to Category
  billingDay: number; // 1-31 (day of month)
  isActive: boolean;
  vaultType: VaultType; // Which vault to deduct from
  lastProcessed: number | null; // Unix timestamp of last deduction
  nextProcessing: number; // Unix timestamp of next deduction
  createdAt: number;
  updatedAt: number;
}

export type SubscriptionInput = Omit<
  Subscription,
  'id' | 'createdAt' | 'updatedAt' | 'lastProcessed' | 'nextProcessing'
>;

// ============================================
// Recurring Expenses
// ============================================

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringExpense {
  id: string; // UUID
  accountId: string; // FK to Account
  name: string;
  amount: number;
  categoryId: string; // FK to Category
  frequency: RecurringFrequency;
  interval: number; // Every X days/weeks/months/years
  nextOccurrence: number; // Unix timestamp
  vaultType: VaultType; // Which vault to deduct from
  isActive: boolean;
  autoDeduct: boolean; // If true, auto-create transaction
  lastProcessed: number | null; // Unix timestamp
  createdAt: number;
  updatedAt: number;
}

export type RecurringExpenseInput = Omit<
  RecurringExpense,
  'id' | 'createdAt' | 'updatedAt' | 'lastProcessed'
>;

// ============================================
// Settings
// ============================================

// Auto-Salary Settings (MMKV in settingsStore)
export interface SalarySettings {
  isEnabled: boolean;
  amount: number;
  categoryId: string; // FK to Category (salary category)
  targetVault: VaultType; // Where to deposit
  lastProcessed: number | null; // Unix timestamp
  nextProcessing: number; // Unix timestamp (1st of next month)
}

// Notification Settings (MMKV)
export interface NotificationSettings {
  nudgesEnabled: boolean;
  nudgeTime: string; // '20:00' format
  subscriptionReminders: boolean;
  recurringReminders: boolean;
  periodicNudgesEnabled: boolean;
}

// App Settings
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  hapticFeedback: boolean;
  currency: string; // Default currency
}

// Security Settings (MMKV)
export interface SecuritySettings {
  isEnabled: boolean; // Master toggle for app lock
  authType: 'biometric' | 'pin' | 'none'; // Authentication method
  biometricEnabled: boolean; // Device supports biometric
  pinHash: string | null; // SHA256 hashed PIN
  autoLockTimeout: number; // Seconds before requiring re-auth (0 = immediate)
  lastAuthTime: number | null; // Unix timestamp of last successful auth
  failedAttempts: number; // Track failed PIN attempts
  maxFailedAttempts: number; // Lock out after X attempts (default: 5)
  lockoutUntil: number | null; // Unix timestamp when lockout expires
}

// Re-export AI types from ai.ts
export type { AISettings } from './ai';

// ============================================
// Analytics & Stats
// ============================================

export interface MonthlyStats {
  totalIncome: number;
  totalExpense: number;
  netChange: number;
  transactionCount: number;
  topCategory: string | null;
  topCategoryAmount: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

// ============================================
// Widget Data
// ============================================

// Widget data structure for Android home screen widget
export interface WidgetData {
  balance: number; // Total balance to display
  accountId: string; // Current account ID
  currencySymbol: string; // Currency symbol (e.g., '$', '€')
  lastUpdated: number; // Unix timestamp
}

// ============================================
// Helper Types
// ============================================

// For balance calculations
export interface BalanceUpdate {
  accountId: string;
  vaultType: VaultType;
  amount: number; // Positive for income, negative for expense
}

// For transaction history grouping
export interface TransactionGroup {
  date: string; // ISO date string (YYYY-MM-DD)
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
}

// ============================================
// Goals
// ============================================

export type GoalFundingSource = 'main' | 'savings' | 'both';

export interface Goal {
  id: string; // UUID
  accountId: string; // FK to Account
  name: string; // Goal name (e.g., "Buy a car", "Vacation")
  targetAmount: number | null; // null for goals without specific price
  currentAmount: number; // Current progress (auto-calculated from vaults)
  fundingSource: GoalFundingSource; // Which vault(s) to track
  icon: string; // Icon name for visual representation
  color: string; // Hex color for theming
  isCompleted: boolean; // True when goal is reached
  completedAt: number | null; // Unix timestamp when completed
  monthlyContribution: number | null; // Planned monthly contribution (e.g., Emergency Fund target/mo)
  targetDate: number | null; // Unix timestamp of target completion date
  createdAt: number;
  updatedAt: number;
}

export type GoalInput = Omit<
  Goal,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'currentAmount'
  | 'isCompleted'
  | 'completedAt'
  | 'monthlyContribution'
  | 'targetDate'
> & {
  currentAmount?: number; // Optional initial amount
  monthlyContribution?: number | null;
  targetDate?: number | null;
};

// ============================================
// Budgets
// ============================================

export interface Budget {
  id: string; // UUID
  accountId: string; // FK to Account
  categoryId: string; // FK to Category (expense categories)
  month: string; // 'YYYY-MM'
  amountLimit: number; // Monthly spending cap for this category
  createdAt: number;
  updatedAt: number;
}

export type BudgetInput = Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>;

export interface BudgetProgress {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amountLimit: number;
  spent: number;
  remaining: number;
  percentage: number; // 0-100+ (uncapped so over-budget is visible)
}

// ============================================
// Debts
// ============================================

export type DebtType = 'lent' | 'borrowed';
export type DebtStatus = 'pending' | 'partial' | 'paid';

export interface Debt {
  id: string; // UUID
  accountId: string; // FK to Account
  type: DebtType; // 'lent' (owed to me) or 'borrowed' (I owe)
  personName: string; // Name of the person
  amount: number; // Total debt amount
  amountPaid: number; // Amount paid so far (for partial payments)
  dueDate: number; // Unix timestamp when debt is due
  status: DebtStatus; // Payment status
  description: string; // Optional notes/description
  categoryId?: string; // Optional FK to Category
  createdAt: number;
  updatedAt: number;
}

export type DebtInput = Omit<
  Debt,
  'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'status'
> & {
  amountPaid?: number; // Optional for initial partial payment
};

// Statistics for debts overview
export interface DebtStats {
  totalLent: number; // Total amount lent to others (pending + partial)
  totalBorrowed: number; // Total amount borrowed from others (pending + partial)
  totalLentPaid: number; // Total amount received back
  totalBorrowedPaid: number; // Total amount paid back
  overdueCount: number; // Number of overdue debts
  pendingLentCount: number; // Number of active debts owed to me
  pendingBorrowedCount: number; // Number of active debts I owe
}
