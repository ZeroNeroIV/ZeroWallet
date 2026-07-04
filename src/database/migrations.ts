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
 * Migration v6: Add budgets table + goal contribution-planning columns
 */
async function migration_v6(database: any): Promise<void> {
  try {
    await database.executeSql(`
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
    `);
    await database.executeSql('CREATE INDEX IF NOT EXISTS idx_budgets_account ON budgets(account_id);');
    await database.executeSql('CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);');
    await database.executeSql('CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);');
    console.log('[Migration v6] budgets table created');
  } catch (error) {
    console.warn('[Migration v6] Error creating budgets table:', error);
  }

  try {
    await database.executeSql(`ALTER TABLE goals ADD COLUMN monthly_contribution REAL;`);
  } catch (error) {
    console.warn('[Migration v6] monthly_contribution column may already exist:', error);
  }

  try {
    await database.executeSql(`ALTER TABLE goals ADD COLUMN target_date INTEGER;`);
  } catch (error) {
    console.warn('[Migration v6] target_date column may already exist:', error);
  }
}
