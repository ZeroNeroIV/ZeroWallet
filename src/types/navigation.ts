import type { NavigatorScreenParams } from '@react-navigation/native';

// ============================================
// Navigation Types
// ============================================

// Root Navigator (switches between Auth and Main)
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

// Auth Stack (Login, Signup)
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

// Main Stack (all authenticated screens)
export type MainStackParamList = {
  Dashboard: undefined;
  AddTransaction: {
    type?: 'income' | 'expense';
  } | undefined;
  TransactionHistory: undefined;
  TransactionDetails: {
    transactionId: string;
  };
  AccountsList: undefined;
  CreateAccount: undefined;
  AccountSettings: {
    accountId: string;
  };
  AccountDetails: {
    accountId: string;
  };
  VaultManagement: undefined;
  CategoriesScreen: undefined;
  CreateCategory: {
    type: 'income' | 'expense';
  } | {
    mode: 'edit';
    categoryId: string;
  };
  SubscriptionsScreen: undefined;
  AddSubscription: undefined | {
    mode: 'edit';
    subscriptionId: string;
  };
  RecurringExpenses: undefined;
  AddRecurring: undefined | {
    mode: 'edit';
    recurringId: string;
  };
  Settings: undefined;
  SalarySettings: undefined;
  SecuritySettings: undefined;
  GoalsScreen: undefined;
  CreateGoal: Record<string, never>;
  EditGoal: {
    goalId: string;
  };
  GoalDetails: {
    goalId: string;
  };
  DebtsScreen: undefined;
  AddDebt: {
    type?: 'lent' | 'borrowed';
  } | undefined;
  DebtDetails: {
    debtId: string;
  };
  EditDebt: {
    debtId: string;
  };
  AISettings: undefined;
  ChatScreen: undefined;
  AllSectionsScreen: undefined;
  BudgetScreen: undefined;
};
