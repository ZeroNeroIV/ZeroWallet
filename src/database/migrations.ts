// Database Migrations
import type SQLite from 'react-native-sqlite-storage';

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
 * SQLite cannot ALTER a CHECK constraint, so each table is rebuilt:
 * create new table, copy rows, drop old, rename. Data is preserved.
 */
async function migration_v6(database: any): Promise<void> {
  console.log('[Migration v6] Widening vault_type constraints to 7 wallets');

  const wallets = `('main', 'savings', 'held', 'salary', 'emergency', 'card', 'physical')`;

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

  for (const { table, create, columns, indexes } of rebuilds) {
    try {
      await database.executeSql(`DROP TABLE IF EXISTS ${table}_new;`);
      await database.executeSql(create);
      await database.executeSql(
        `INSERT INTO ${table}_new (${columns}) SELECT ${columns} FROM ${table};`
      );
      await database.executeSql(`DROP TABLE ${table};`);
      await database.executeSql(`ALTER TABLE ${table}_new RENAME TO ${table};`);
      for (const indexSql of indexes) {
        try {
          await database.executeSql(indexSql.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS'));
        } catch (indexError) {
          console.warn(`[Migration v6] Index may already exist for ${table}:`, indexError);
        }
      }
      console.log(`[Migration v6] Rebuilt ${table} with widened vault_type`);
    } catch (error) {
      console.warn(`[Migration v6] Rebuild skipped/failed for ${table}:`, error);
    }
  }
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
