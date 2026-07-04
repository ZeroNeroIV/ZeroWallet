// SQLite Database Schema Definitions

export const SCHEMA_VERSION = 6;

// ============================================
// Table Creation SQL
// ============================================

export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

export const CREATE_ACCOUNTS_TABLE = `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`;

export const CREATE_CATEGORIES_TABLE = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`;

export const CREATE_TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    amount REAL NOT NULL,
    category_id TEXT NOT NULL,
    description TEXT,
    date INTEGER NOT NULL,
    vault_type TEXT NOT NULL CHECK(vault_type IN ('main', 'savings', 'held')),
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurring_expense_id TEXT,
    subscription_id TEXT,
    image_path TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    original_amount REAL,
    exchange_rate REAL,
    converted_amount REAL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`;

export const CREATE_SUBSCRIPTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT NOT NULL,
    billing_day INTEGER NOT NULL CHECK(billing_day >= 1 AND billing_day <= 31),
    is_active INTEGER NOT NULL DEFAULT 1,
    vault_type TEXT NOT NULL CHECK(vault_type IN ('main', 'savings')),
    last_processed INTEGER,
    next_processing INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`;

export const CREATE_RECURRING_EXPENSES_TABLE = `
  CREATE TABLE IF NOT EXISTS recurring_expenses (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval INTEGER NOT NULL DEFAULT 1,
    next_occurrence INTEGER NOT NULL,
    vault_type TEXT NOT NULL CHECK(vault_type IN ('main', 'savings')),
    is_active INTEGER NOT NULL DEFAULT 1,
    auto_deduct INTEGER NOT NULL DEFAULT 1,
    last_processed INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`;

export const CREATE_GOALS_TABLE = `
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_amount REAL,
    current_amount REAL NOT NULL DEFAULT 0,
    funding_source TEXT NOT NULL CHECK(funding_source IN ('main', 'savings', 'both')),
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    monthly_contribution REAL,
    target_date INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );
`;

export const CREATE_BUDGETS_TABLE = `
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    month TEXT NOT NULL,
    amount_limit REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    UNIQUE(account_id, category_id, month)
  );
`;

export const CREATE_TRANSACTION_IMAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS transaction_images (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    image_path TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
  );
`;

export const CREATE_DEBTS_TABLE = `
  CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('lent', 'borrowed')),
    person_name TEXT NOT NULL,
    amount REAL NOT NULL,
    amount_paid REAL NOT NULL DEFAULT 0,
    due_date INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'partial', 'paid')),
    description TEXT,
    category_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`;

// ============================================
// Indexes for Performance
// ============================================

export const CREATE_INDEXES = [
  // Transactions indexes (most queried table)
  'CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);',
  'CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);',
  'CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);',
  'CREATE INDEX IF NOT EXISTS idx_transactions_vault ON transactions(vault_type);',

  // Accounts indexes
  'CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);',

  // Categories indexes
  'CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);',

  // Subscriptions indexes
  'CREATE INDEX IF NOT EXISTS idx_subscriptions_account ON subscriptions(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active);',

  // Recurring expenses indexes
  'CREATE INDEX IF NOT EXISTS idx_recurring_account ON recurring_expenses(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_expenses(is_active);',

  // Goals indexes
  'CREATE INDEX IF NOT EXISTS idx_goals_account ON goals(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_goals_completed ON goals(is_completed);',

  // Transaction images indexes
  'CREATE INDEX IF NOT EXISTS idx_tx_images_tx ON transaction_images(transaction_id);',

  // Debts indexes
  'CREATE INDEX IF NOT EXISTS idx_debts_account ON debts(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);',
  'CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);',
  'CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(type);',

  // Budgets indexes
  'CREATE INDEX IF NOT EXISTS idx_budgets_account ON budgets(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);',
  'CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);',
];

// ============================================
// All Table Creation Statements
// ============================================

export const ALL_TABLES = [
  CREATE_USERS_TABLE,
  CREATE_ACCOUNTS_TABLE,
  CREATE_CATEGORIES_TABLE,
  CREATE_TRANSACTIONS_TABLE,
  CREATE_TRANSACTION_IMAGES_TABLE,
  CREATE_SUBSCRIPTIONS_TABLE,
  CREATE_RECURRING_EXPENSES_TABLE,
  CREATE_GOALS_TABLE,
  CREATE_DEBTS_TABLE,
  CREATE_BUDGETS_TABLE,
];
