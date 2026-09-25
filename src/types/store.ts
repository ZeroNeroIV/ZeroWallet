// Store-related types
import type {
  User,
  Account,
  AccountBalance,
  SalarySettings,
  NotificationSettings,
  AppSettings,
  SecuritySettings,
  AISettings,
  VaultType,
} from './models';

// ============================================
// Auth Store Types
// ============================================

export interface AuthState {
  currentUser: User | null;
  currentAccountId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, currency?: string) => Promise<Account>;
  logout: () => void;
  switchAccount: (accountId: string) => void;
  setCurrentUser: (user: User | null) => void;
  clearError: () => void;
}

// ============================================
// Account Store Types
// ============================================

export interface AccountState {
  balances: Record<string, AccountBalance>; // Key: accountId
  isLoading: boolean;

  // Actions
  updateBalance: (
    accountId: string,
    updates: Partial<AccountBalance>
  ) => void;
  transferBetweenVaults: (
    accountId: string,
    from: VaultType,
    to: VaultType,
    amount: number
  ) => void;
  getCurrentBalance: () => AccountBalance | null;
  getAccountBalance: (accountId: string) => AccountBalance | null;
  initializeBalance: (accountId: string) => void;
  resetBalances: () => void;
  clearAccounts: () => void;
}

// ============================================
// Vault Store Types
// ============================================

export interface VaultState {
  // Current account's vault balances
  addToVault: (vault: VaultType, amount: number) => void;
  subtractFromVault: (vault: VaultType, amount: number) => void;
  getVaultBalance: (vault: VaultType) => number;
  getAvailableToSpend: () => number; // main + savings (excludes held)
}

// ============================================
// Settings Store Types
// ============================================

export interface SettingsState {
  salarySettings: SalarySettings;
  notificationSettings: NotificationSettings;
  appSettings: AppSettings;
  securitySettings: SecuritySettings;
  aiSettings: AISettings;
  hasSeenIntro: boolean;

  // Actions
  markIntroSeen: () => void;
  updateSalarySettings: (settings: Partial<SalarySettings>) => void;
  updateNotificationSettings: (
    settings: Partial<NotificationSettings>
  ) => void;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  updateSecuritySettings: (settings: Partial<SecuritySettings>) => void;
  updateAISettings: (settings: Partial<AISettings>) => void;
  resetSettings: () => void;
}

// ============================================
// UI Store Types
// ============================================

export interface UIState {
  isAddTransactionVisible: boolean;
  isLoading: boolean;
  activeBottomSheet: string | null;
  showFAB: boolean;
  error: string | null;
  isBalanceHidden: boolean;

  // Actions
  setLoading: (loading: boolean) => void;
  toggleAddTransaction: () => void;
  setActiveBottomSheet: (sheetId: string | null) => void;
  setShowFAB: (show: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  toggleBalanceHidden: () => void;
  setBalanceHidden: (hidden: boolean) => void;
}
