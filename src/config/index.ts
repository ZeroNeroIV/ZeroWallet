// Centralized application configuration
// All hardcoded values, magic numbers, and environment-specific settings
// Import this instead of sprinkling literals through business logic

export const config = {
  // Database
  database: {
    name: 'wallet.db',
    location: 'default',
    schemaVersion: 5,
  },

  // Currency exchange
  currency: {
    apiUrl: 'https://cdn.moneyconvert.net/api/latest.json',
    cacheDurationMs: 5 * 60 * 1000,       // 5 minutes (API terms)
    staleThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
    defaultCurrency: 'USD' as string,
    roundDecimals: 2,
  },

  // AI / Gemini
  ai: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    temperature: 0.7,
    maxOutputTokens: {
      'gemini-1.5-pro': 2048,
      default: 1024,
    },
    apiKeyValidationPath: '/v1beta/models',
    pendingActionTtlMs: 5 * 60 * 1000,    // 5 minutes
    maxWriteOpsPerMinute: 10,
    maxContextMessages: 100,
    defaultFallback: 'I apologize, but I was unable to generate a response.',
  },

  // UI defaults
  ui: {
    dashboardTransactionLimit: 5,
    dashboardChartDays: 7,
    headerHideThreshold: 50,
    fadeInDuration: 200,
    scrollHideThreshold: 5,
    scrollShowThreshold: -5,
    headerTranslateY: -100,
    animationDuration: 200,
  },

  // Validation
  validation: {
    passwordMinLength: 6,
    nameMinLength: 2,
    nameMaxLength: 100,
    categoryNameMaxLength: 50,
    goalNameMaxLength: 100,
    personNameMaxLength: 100,
    subscriptionNameMaxLength: 100,
    expenseNameMaxLength: 100,
  },

  // Defaults for entity creation
  defaults: {
    vaultType: 'main' as const,
    fundingSource: 'savings' as const,
    icon: 'help-circle' as const,
    color: '#6366F1' as const,
    goalIcon: 'flag' as const,
    goalColor: '#4CAF50' as const,
    isRecurring: false,
    autoDeduct: false,
  },

  // Security
  security: {
    maxFailedAttempts: 5,
    defaultAutoLockTimeout: 0, // 0 = immediate
  },

  // Background tasks
  backgroundTasks: {
    salaryMonthLabel: {
      single: '1 month',
      multiple: (count: number) => `${count} months`,
    },
  },

  // Deep linking
  deepLink: {
    scheme: 'wallet://',
    routes: {
      addTransaction: 'add-transaction',
      login: 'login',
      signup: 'signup',
    },
  },

  // Logging
  logging: {
    dbPrefix: '[DB]',
    currencyPrefix: '[CurrencyService]',
    geminiPrefix: '[GeminiService]',
    dashboardPrefix: '[Dashboard]',
    accountStorePrefix: '[AccountStore]',
    aiChatPrefix: '[AIChatStore]',
    transactionRepoPrefix: '[TransactionRepo]',
    accountRepoPrefix: '[AccountRepo]',
    goalRepoPrefix: '[GoalRepo]',
    categoryRepoPrefix: '[CategoryRepo]',
  },
} as const;

export type Config = typeof config;
