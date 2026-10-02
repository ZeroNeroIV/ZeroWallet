// Database Migrations
import type SQLite from 'react-native-sqlite-storage';
import { VAULT_TYPE_VALUES } from '../domain/vault/VaultType';
import { WALLET_META } from '../utils/wallets';

// ============================================
// Migration Runner
// ============================================

export async function runMigrations(
  database: SQLite.SQLiteDatabase,
  fromVersion: number,
  toVersion: number
): Promise<void> {
  console.log(`[Migrations] Running migrations from v${fromVersion} to v${toVersion}`);

  // Run migrations in order
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    console.log(`[Migrations] Applying migration v${version}...`);
    await applyMigration(database, version);
    console.log(`[Migrations] Migration v${version} applied successfully`);
  }
}

// ============================================
// Individual Migrations
// ============================================

async function applyMigration(
  database: SQLite.SQLiteDatabase,
  version: number
): Promise<void> {
  switch (version) {
    case 1:
      // Initial schema creation is handled by schema.ts
      // This migration is a placeholder
      break;

    case 2:
      // Add image_path column to transactions table
      await migration_v2(database);
      break;

    case 3:
      // Add debts table
      await migration_v3(database);
      break;

    case 4:
      // Add currency support to transactions
      await migration_v4(database);
      break;

    case 5:
      await migration_v5(database);
      break;

    case 6:
      await migration_v6(database);
      break;

    case 7:
      await migration_v7(database);
      break;

    case 8:
      await migration_v8(database);
      break;

    case 9:
      await migration_v9(database);
      break;

    case 10:
      await migration_v10(database);
      break;

    case 11:
      await migration_v11(database);
      break;

    case 12:
      await migration_v12(database);
      break;

    default:
      console.warn(`[Migrations] No migration defined for version ${version}`);
  }
}

// ============================================
// Migration Functions
// ============================================

/**
 * Migration v2: Add image_path column to transactions
 */
async function migration_v2(database: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[Migration v2] Adding image_path column to transactions table');

  try {
    await database.executeSql(`
      ALTER TABLE transactions ADD COLUMN image_path TEXT;
    `);

    console.log('[Migration v2] Successfully added image_path column');
  } catch (error) {
    // Column might already exist if schema was created fresh
    console.warn('[Migration v2] Column may already exist:', error);
  }
}

/**
 * Migration v3: Add debts table
 */
async function migration_v3(database: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[Migration v3] Creating debts table');

  try {
    // Create debts table
    await database.executeSql(`
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
    `);

    // Create indexes
    await database.executeSql('CREATE INDEX IF NOT EXISTS idx_debts_account ON debts(account_id);');
    await database.executeSql('CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);');
    await database.executeSql('CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);');
    await database.executeSql('CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(type);');

    console.log('[Migration v3] Successfully created debts table and indexes');
  } catch (error) {
    console.error('[Migration v3] Error creating debts table:', error);
    throw error;
  }
}

/**
 * Migration v4: Add currency support to transactions
 */
async function migration_v4(database: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[Migration v4] Adding currency columns to transactions table');

  try {
    // Add currency columns to transactions table
    await database.executeSql(`
      ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
    `);

    await database.executeSql(`
      ALTER TABLE transactions ADD COLUMN original_amount REAL;
    `);

    await database.executeSql(`
      ALTER TABLE transactions ADD COLUMN exchange_rate REAL;
    `);

    await database.executeSql(`
      ALTER TABLE transactions ADD COLUMN converted_amount REAL;
    `);

    console.log('[Migration v4] Successfully added currency columns');
  } catch (error) {
    // Columns might already exist if schema was created fresh
    console.warn('[Migration v4] Columns may already exist:', error);
  }
}

/**
 * Migration v6: Widen vault_type CHECK constraints to all 7 wallets.
 * SQLite cannot ALTER a CHECK constraint, so each table is rebuilt in a
 * kill-safe order: build the new table, move the old one to a backup name,
 * promote the new table, then verify and drop the backup. If anything
 * fails, an error is THROWN so the schema version does NOT advance and the
 * migration is retried on next launch (never a silent half-migration).
 */
async function migration_v6(database: any): Promise<void> {
  console.log('[Migration v6] Widening vault_type constraints to 7 wallets');

  const wallets = `('main', 'savings', 'held', 'salary', 'emergency', 'card', 'physical')`;
  const walletKeys = ['main', 'savings', 'held', 'salary', 'emergency', 'card', 'physical'];

  const rebuilds: Array<{ table: string; create: string; columns: string; indexes: string[] }> = [
    {
      table: 'transactions',
      columns: 'id, account_id, type, amount, category_id, description, date, vault_type, is_recurring, recurring_expense_id, subscription_id, image_path, currency, original_amount, exchange_rate, converted_amount, created_at, updated_at',
      create: `CREATE TABLE transactions_new (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL,
        category_id TEXT NOT NULL,
        description TEXT,
        date INTEGER NOT NULL,
        vault_type TEXT NOT NULL CHECK(vault_type IN ${wallets}),
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
      );`,
      indexes: [
        'CREATE INDEX idx_transactions_account ON transactions(account_id);',
        'CREATE INDEX idx_transactions_date ON transactions(date);',
        'CREATE INDEX idx_transactions_category ON transactions(category_id);',
        'CREATE INDEX idx_transactions_type ON transactions(type);',
        'CREATE INDEX idx_transactions_vault ON transactions(vault_type);',
      ],
    },
    {
      table: 'subscriptions',
      columns: 'id, account_id, name, amount, category_id, billing_day, is_active, vault_type, last_processed, next_processing, created_at, updated_at',
      create: `CREATE TABLE subscriptions_new (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        category_id TEXT NOT NULL,
        billing_day INTEGER NOT NULL CHECK(billing_day >= 1 AND billing_day <= 31),
        is_active INTEGER NOT NULL DEFAULT 1,
        vault_type TEXT NOT NULL CHECK(vault_type IN ${wallets}),
        last_processed INTEGER,
        next_processing INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );`,
      indexes: [
        'CREATE INDEX idx_subscriptions_account ON subscriptions(account_id);',
        'CREATE INDEX idx_subscriptions_active ON subscriptions(is_active);',
      ],
    },
    {
      table: 'recurring_expenses',
      columns: 'id, account_id, name, amount, category_id, frequency, interval, next_occurrence, vault_type, is_active, auto_deduct, last_processed, created_at, updated_at',
      create: `CREATE TABLE recurring_expenses_new (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        category_id TEXT NOT NULL,
        frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
        interval INTEGER NOT NULL DEFAULT 1,
        next_occurrence INTEGER NOT NULL,
        vault_type TEXT NOT NULL CHECK(vault_type IN ${wallets}),
        is_active INTEGER NOT NULL DEFAULT 1,
        auto_deduct INTEGER NOT NULL DEFAULT 1,
        last_processed INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );`,
      indexes: [
        'CREATE INDEX idx_recurring_account ON recurring_expenses(account_id);',
        'CREATE INDEX idx_recurring_active ON recurring_expenses(is_active);',
      ],
    },
  ];

  // Recover from an interrupted previous attempt: if a backup table is
  // left behind, the original was already moved aside, so promote the
  // backup back before rebuilding (its data is intact).
  for (const { table } of rebuilds) {
    try {
      const [backupCheck] = await database.executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        [`${table}_backup`]
      );
      const [liveCheck] = await database.executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        [table]
      );
      if (backupCheck.rows.length > 0 && liveCheck.rows.length === 0) {
        console.log(`[Migration v6] Restoring interrupted rebuild of ${table} from backup`);
        await database.executeSql(`ALTER TABLE ${table}_backup RENAME TO ${table};`);
      } else if (backupCheck.rows.length > 0) {
        await database.executeSql(`DROP TABLE ${table}_backup;`);
      }
    } catch (recoverError) {
      console.warn(`[Migration v6] Recovery check failed for ${table}:`, recoverError);
    }
  }

  for (const { table, create, columns, indexes } of rebuilds) {
    await database.executeSql(`DROP TABLE IF EXISTS ${table}_new;`);
    await database.executeSql(create);
    await database.executeSql(
      `INSERT INTO ${table}_new (${columns}) SELECT ${columns} FROM ${table};`
    );
    // Move the original aside (NOT dropped): a kill here leaves either the
    // original or the backup intact, never data loss
    await database.executeSql(`DROP TABLE IF EXISTS ${table}_backup;`);
    await database.executeSql(`ALTER TABLE ${table} RENAME TO ${table}_backup;`);
    await database.executeSql(`ALTER TABLE ${table}_new RENAME TO ${table};`);
    for (const indexSql of indexes) {
      await database.executeSql(indexSql.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS'));
    }

    // Verify the live table actually carries the widened constraint before
    // dropping the backup — throws on failure so the version never advances
    // on a half-migrated database (retry happens next launch)
    const [defRows] = await database.executeSql(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name=?;`,
      [table]
    );
    if (defRows && defRows.rows.length > 0) {
      const tableSql: string = defRows.rows.item(0)?.sql ?? '';
      const missing = walletKeys.filter((key) => !tableSql.includes(`'${key}'`));
      if (missing.length > 0) {
        throw new Error(`[Migration v6] Verification failed for ${table}: missing wallets ${missing.join(',')}`);
      }
    }
    const [countRows] = await database.executeSql(`SELECT COUNT(*) as count FROM ${table};`);
    console.log(`[Migration v6] Rebuilt ${table} with widened vault_type (${countRows.rows.item(0)?.count ?? 0} rows preserved)`);

    await database.executeSql(`DROP TABLE ${table}_backup;`);
  }
}

/**
 * Migration v7: Repair pass for devices stuck on a failed v6 upgrade.
 * The v6 rebuild is fully idempotent (verified), so re-running it heals
 * databases whose tables still carry the old 3-wallet CHECK while the
 * recorded version already says 6. Healthy databases are rebuilt
 * harmlessly with identical data.
 */
async function migration_v7(database: any): Promise<void> {
  console.log('[Migration v7] Repair pass: re-running vault table rebuild');
  await migration_v6(database);
  console.log('[Migration v7] Repair pass complete');
}

/**
 * Migration v8: Add updated_at to categories.
 * BaseRepository.create()/update() always write updated_at, but the
 * categories table never had the column — so EVERY category insert or
 * update failed with SQLITE_ERROR (this broke LAYA category creation,
 * manual category creation/editing, and transfer setup which auto-creates
 * Transfer categories). Checks sqlite_master first so re-runs are safe;
 * throws on real failure so the version does not advance on a broken DB.
 */
async function migration_v8(database: any): Promise<void> {
  console.log('[Migration v8] Adding updated_at column to categories table');

  const [defRows] = await database.executeSql(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='categories';`
  );
  const tableSql: string = defRows.rows.item(0)?.sql ?? '';
  if (tableSql.includes('updated_at')) {
    console.log('[Migration v8] Column already exists, nothing to do');
    return;
  }

  await database.executeSql(
    `ALTER TABLE categories ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;`
  );
  console.log('[Migration v8] Successfully added updated_at column');
}

async function migration_v5(database: any): Promise<void> {
  try {
    await database.executeSql(`
      CREATE TABLE IF NOT EXISTS transaction_images (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        image_path TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      );
    `);
    await database.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_tx_images_tx ON transaction_images(transaction_id);`
    );
    console.log('[Migration v5] transaction_images table created');
  } catch (error) {
    console.warn('[Migration v5] Error:', error);
  }
}

/**
 * Migration v9: Rebuild wallets table with PRIMARY KEY (id, account_id).
 * This allows multiple accounts to each have their own default wallets
 * ('main', 'savings', 'held', etc.) without primary key collisions.
 * Preserves existing wallet customizations and seeds 7 default wallets
 * for all existing accounts.
 */
async function migration_v9(database: any): Promise<void> {
  console.log('[Migration v9] Rebuilding wallets table with compound primary key (id, account_id)');

  // 1. Recover from interrupted rebuild if needed
  try {
    const [backupCheck] = await database.executeSql(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='wallets_backup';"
    );
    const [liveCheck] = await database.executeSql(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='wallets';"
    );
    if (backupCheck.rows.length > 0 && liveCheck.rows.length === 0) {
      console.log('[Migration v9] Restoring interrupted rebuild of wallets from backup');
      await database.executeSql('ALTER TABLE wallets_backup RENAME TO wallets;');
    } else if (backupCheck.rows.length > 0) {
      await database.executeSql('DROP TABLE wallets_backup;');
    }
  } catch (recoverError) {
    console.warn('[Migration v9] Recovery check failed for wallets:', recoverError);
  }

  // 2. Create wallets_new with compound primary key
  await database.executeSql('DROP TABLE IF EXISTS wallets_new;');
  await database.executeSql(`
    CREATE TABLE wallets_new (
      id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (id, account_id),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );
  `);

  // 3. Copy existing wallets if table exists
  try {
    await database.executeSql(`
      INSERT OR IGNORE INTO wallets_new (id, account_id, name, icon, color, is_default, created_at, updated_at)
      SELECT id, account_id, name, icon, color, is_default, created_at, updated_at FROM wallets;
    `);
  } catch (copyErr) {
    console.warn('[Migration v9] Notice copying existing wallets (table might be new):', copyErr);
  }

  // 4. Atomic-like table replacement
  await database.executeSql('DROP TABLE IF EXISTS wallets_backup;');
  await database.executeSql('ALTER TABLE wallets RENAME TO wallets_backup;');
  await database.executeSql('ALTER TABLE wallets_new RENAME TO wallets;');
  await database.executeSql('CREATE INDEX IF NOT EXISTS idx_wallets_account ON wallets(account_id);');

  // 5. Verification
  const [defRows] = await database.executeSql(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='wallets';"
  );
  if (defRows && defRows.rows.length > 0) {
    const tableSql: string = defRows.rows.item(0)?.sql ?? '';
    if (!tableSql.includes('account_id') || !tableSql.toLowerCase().includes('primary key')) {
      throw new Error('[Migration v9] Verification failed for wallets: compound primary key not found');
    }
  }

  await database.executeSql('DROP TABLE wallets_backup;');

  // 6. Ensure the 7 built-in wallets exist for all existing accounts
  const [accRows] = await database.executeSql('SELECT id FROM accounts;');
  const now = Date.now();
  for (let i = 0; i < accRows.rows.length; i++) {
    const accountId = accRows.rows.item(i).id;
    for (const key of VAULT_TYPE_VALUES) {
      const meta = WALLET_META[key as keyof typeof WALLET_META];
      if (!meta) continue;
      await database.executeSql(
        `INSERT OR IGNORE INTO wallets (id, account_id, name, icon, color, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?);`,
        [key, accountId, meta.name, meta.icon, meta.color, now, now]
      );
    }
  }

  console.log('[Migration v9] Wallets table successfully rebuilt with (id, account_id) PK');
}

/**
 * Migration v10:
 * 1. Create budgets table with foreign keys & indexes.
 * 2. Widen vault_type in transactions, subscriptions, and recurring_expenses
 *    to TEXT NOT NULL without restrictive CHECK constraint so dynamic
 *    and custom wallets can be freely created, assigned, and reassigned.
 */
async function migration_v10(database: any): Promise<void> {
  console.log('[Migration v10] Creating budgets table and removing restrictive vault_type check constraints');

  // 1. Create budgets table and indexes
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      amount REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly', 'weekly', 'yearly')),
      rollover INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
  `);
  await database.executeSql('CREATE INDEX IF NOT EXISTS idx_budgets_account ON budgets(account_id);');
  await database.executeSql('CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);');

  // 2. Rebuild transactions, subscriptions, recurring_expenses without vault_type CHECK constraint
  const rebuilds = [
    {
      table: 'transactions',
      columns:
        'id, account_id, type, amount, category_id, description, date, vault_type, is_recurring, recurring_expense_id, subscription_id, image_path, currency, original_amount, exchange_rate, converted_amount, created_at, updated_at',
      create: `CREATE TABLE transactions_new (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL,
        category_id TEXT NOT NULL,
        description TEXT,
        date INTEGER NOT NULL,
        vault_type TEXT NOT NULL,
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
      );`,
      indexes: [
        'CREATE INDEX idx_transactions_account ON transactions(account_id);',
        'CREATE INDEX idx_transactions_date ON transactions(date);',
        'CREATE INDEX idx_transactions_category ON transactions(category_id);',
        'CREATE INDEX idx_transactions_type ON transactions(type);',
        'CREATE INDEX idx_transactions_vault ON transactions(vault_type);',
      ],
    },
    {
      table: 'subscriptions',
      columns:
        'id, account_id, name, amount, category_id, billing_day, is_active, vault_type, last_processed, next_processing, created_at, updated_at',
      create: `CREATE TABLE subscriptions_new (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        category_id TEXT NOT NULL,
        billing_day INTEGER NOT NULL CHECK(billing_day >= 1 AND billing_day <= 31),
        is_active INTEGER NOT NULL DEFAULT 1,
        vault_type TEXT NOT NULL,
        last_processed INTEGER,
        next_processing INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );`,
      indexes: [
        'CREATE INDEX idx_subscriptions_account ON subscriptions(account_id);',
        'CREATE INDEX idx_subscriptions_active ON subscriptions(is_active);',
      ],
    },
    {
      table: 'recurring_expenses',
      columns:
        'id, account_id, name, amount, category_id, frequency, interval, next_occurrence, vault_type, is_active, auto_deduct, last_processed, created_at, updated_at',
      create: `CREATE TABLE recurring_expenses_new (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        category_id TEXT NOT NULL,
        frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
        interval INTEGER NOT NULL DEFAULT 1,
        next_occurrence INTEGER NOT NULL,
        vault_type TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        auto_deduct INTEGER NOT NULL DEFAULT 1,
        last_processed INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );`,
      indexes: [
        'CREATE INDEX idx_recurring_account ON recurring_expenses(account_id);',
        'CREATE INDEX idx_recurring_active ON recurring_expenses(is_active);',
      ],
    },
  ];

  for (const { table, create, columns, indexes } of rebuilds) {
    try {
      const [backupCheck] = await database.executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        [`${table}_backup`]
      );
      const [liveCheck] = await database.executeSql(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        [table]
      );
      if (backupCheck.rows.length > 0 && liveCheck.rows.length === 0) {
        await database.executeSql(`ALTER TABLE ${table}_backup RENAME TO ${table};`);
      } else if (backupCheck.rows.length > 0) {
        await database.executeSql(`DROP TABLE ${table}_backup;`);
      }
    } catch (recoverErr) {
      console.warn(`[Migration v10] Recovery check failed for ${table}:`, recoverErr);
    }

    await database.executeSql(`DROP TABLE IF EXISTS ${table}_new;`);
    await database.executeSql(create);
    await database.executeSql(
      `INSERT INTO ${table}_new (${columns}) SELECT ${columns} FROM ${table};`
    );
    await database.executeSql(`DROP TABLE IF EXISTS ${table}_backup;`);
    await database.executeSql(`ALTER TABLE ${table} RENAME TO ${table}_backup;`);
    await database.executeSql(`ALTER TABLE ${table}_new RENAME TO ${table};`);
    for (const indexSql of indexes) {
      await database.executeSql(indexSql.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS'));
    }
    await database.executeSql(`DROP TABLE ${table}_backup;`);
  }

  console.log('[Migration v10] Successfully applied migration v10');
}

/**
 * Migration v11: Add sort_order to wallets table for custom wallet reordering
 */
export async function migration_v11(database: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[Migration] Running migration v11 (add sort_order to wallets)...');
  try {
    await database.executeSql(
      'ALTER TABLE wallets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;'
    );
    console.log('[Migration v11] Successfully added sort_order to wallets table');
  } catch (err: any) {
    if (err?.message?.includes('duplicate column')) {
      console.log('[Migration v11] sort_order column already exists');
    } else {
      console.warn('[Migration v11] Warning adding sort_order to wallets:', err);
    }
  }
}

/**
 * Migration v12: The Great Simplification (KISS)
 * 1. Add destination_wallet_id to transactions table for direct wallet-to-wallet transfers
 * 2. Add wallet_id to transactions table if missing and populate from vault_type
 * 3. Create unified recurring_transactions table (merging subscriptions & recurring_expenses)
 * 4. Migrate existing subscriptions and recurring_expenses into recurring_transactions
 */
export async function migration_v12(database: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[Migration] Running migration v12 (KISS: unified Wallets & Recurring)...');

  // 1. Add wallet_id and destination_wallet_id to transactions
  try {
    await database.executeSql('ALTER TABLE transactions ADD COLUMN wallet_id TEXT;');
  } catch (err: any) {
    if (!err?.message?.includes('duplicate column')) {
      console.warn('[Migration v12] transactions.wallet_id notice:', err);
    }
  }

  try {
    await database.executeSql('ALTER TABLE transactions ADD COLUMN destination_wallet_id TEXT;');
  } catch (err: any) {
    if (!err?.message?.includes('duplicate column')) {
      console.warn('[Migration v12] transactions.destination_wallet_id notice:', err);
    }
  }

  // Populate wallet_id from vault_type for existing records
  try {
    await database.executeSql('UPDATE transactions SET wallet_id = vault_type WHERE wallet_id IS NULL OR wallet_id = "";');
  } catch (err: any) {
    console.warn('[Migration v12] populate wallet_id warning:', err);
  }

  // 2. Create recurring_transactions table
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      destination_wallet_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'transfer')),
      amount REAL NOT NULL,
      category_id TEXT,
      frequency_unit TEXT NOT NULL CHECK(frequency_unit IN ('day', 'week', 'month', 'year')),
      frequency_interval INTEGER NOT NULL DEFAULT 1,
      billing_day INTEGER,
      start_date INTEGER NOT NULL,
      end_date INTEGER,
      next_run_date INTEGER NOT NULL,
      last_run_date INTEGER,
      auto_deduct INTEGER NOT NULL DEFAULT 1,
      reminder_days_before INTEGER NOT NULL DEFAULT 1,
      is_subscription INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await database.executeSql('CREATE INDEX IF NOT EXISTS idx_recurring_tx_wallet ON recurring_transactions(wallet_id);');
  await database.executeSql('CREATE INDEX IF NOT EXISTS idx_recurring_tx_next ON recurring_transactions(next_run_date);');
  await database.executeSql('CREATE INDEX IF NOT EXISTS idx_recurring_tx_active ON recurring_transactions(is_active);');

  // 3. Migrate subscriptions into recurring_transactions
  try {
    await database.executeSql(`
      INSERT OR IGNORE INTO recurring_transactions (
        id, wallet_id, name, type, amount, category_id,
        frequency_unit, frequency_interval, billing_day,
        start_date, next_run_date, last_run_date,
        auto_deduct, reminder_days_before, is_subscription, is_active,
        created_at, updated_at
      )
      SELECT
        id, vault_type, name, 'expense', amount, category_id,
        'month', 1, billing_day,
        created_at, next_processing, last_processed,
        1, 1, 1, is_active,
        created_at, updated_at
      FROM subscriptions;
    `);
    console.log('[Migration v12] Migrated subscriptions into recurring_transactions');
  } catch (err: any) {
    console.warn('[Migration v12] subscriptions migration notice:', err);
  }

  // 4. Migrate recurring_expenses into recurring_transactions
  try {
    await database.executeSql(`
      INSERT OR IGNORE INTO recurring_transactions (
        id, wallet_id, name, type, amount, category_id,
        frequency_unit, frequency_interval,
        start_date, next_run_date, last_run_date,
        auto_deduct, reminder_days_before, is_subscription, is_active,
        created_at, updated_at
      )
      SELECT
        id, vault_type, name, 'expense', amount, category_id,
        CASE frequency
          WHEN 'daily' THEN 'day'
          WHEN 'weekly' THEN 'week'
          WHEN 'monthly' THEN 'month'
          WHEN 'yearly' THEN 'year'
          ELSE 'month'
        END,
        COALESCE(interval, 1),
        created_at, next_occurrence, last_processed,
        COALESCE(auto_deduct, 1), 1, 0, is_active,
        created_at, updated_at
      FROM recurring_expenses;
    `);
    console.log('[Migration v12] Migrated recurring_expenses into recurring_transactions');
  } catch (err: any) {
    console.warn('[Migration v12] recurring_expenses migration notice:', err);
  }

  console.log('[Migration v12] Successfully applied migration v12');
}

