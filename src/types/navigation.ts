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
    type?: 'income' | 'expense' | 'transfer';
    initialDate?: number;
    transactionId?: string;
    fromWalletId?: string;
    toWalletId?: string;
  } | undefined;
  TransactionHistory: undefined;
  TransactionDetails: {
    transactionId: string;
  };
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
  Recurring:
    | {
        tab?: 'subscriptions' | 'recurring';
      }
    | undefined;
  AddSubscription: undefined | {
    mode: 'edit';
    subscriptionId: string;
  };
  AddRecurring: undefined | {
    mode: 'edit';
    recurringId: string;
  };
  Settings: undefined;
  SalarySettings: undefined;
  SmartNudges: undefined;
  Wallets: undefined;
  WalletDetails: {
    walletId: string;
  };
  SecuritySettings: undefined;
  GoogleDriveBackup: undefined;
  GoalsDebtsHub:
    | {
        initialTab?: 'goals' | 'debts';
      }
    | undefined;
  GoalsScreen: undefined;
  CreateGoal: { goalId?: string } | undefined;
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
  Analytics: undefined;
  Transfer:
    | {
        fromWalletId?: string;
        toWalletId?: string;
      }
    | undefined;
  AccountsList: undefined;
  CreateAccount: undefined;
};
