// SQLite Database Initialization and Management
import SQLite from 'react-native-sqlite-storage';
import { ALL_TABLES, CREATE_INDEXES, SCHEMA_VERSION } from './schema';
import { healDatabase } from './dataHealer';
import { runMigrations as executeMigrations } from './migrations';

// Enable promises for SQLite
SQLite.enablePromise(true);

// Enable debugging in development
if (__DEV__) {
  SQLite.DEBUG(true);
}

let db: SQLite.SQLiteDatabase | null = null;

// ============================================
// Database Initialization
// ============================================

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  try {
    if (db) {
      console.log('[DB] Database already initialized');
      return db;
    }

    console.log('[DB] Opening database...');
    db = await SQLite.openDatabase({
      name: 'wallet.db',
      location: 'default',
    });

    console.log('[DB] Database opened successfully');

    // Keep foreign keys OFF during table creation, migration, and data healing
    // to allow safe table rebuilds and healing of legacy data formats
    await db.executeSql('PRAGMA foreign_keys = OFF;');
    await db.executeSql('PRAGMA journal_mode = WAL;');
    await db.executeSql('PRAGMA synchronous = NORMAL;');

    // Create all tables
    await createTables(db);

    // Create indexes
    await createIndexes(db);

    // Check schema version and run migrations if needed
    await checkAndRunMigrations(db);

    // Heal and normalize legacy data (backward compatibility)
    await healDatabase(db);

    // Enforce foreign keys now that data is clean and consistent
    await db.executeSql('PRAGMA foreign_keys = ON;');

    console.log('[DB] Database initialization complete');
    return db;
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}

// ============================================
// Get Database Instance
// ============================================

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ============================================
// Create Tables
// ============================================

async function createTables(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    console.log('[DB] Creating tables...');

    for (const tableSQL of ALL_TABLES) {
      await database.executeSql(tableSQL);
    }

    console.log('[DB] All tables created successfully');
  } catch (error) {
    console.error('[DB] Failed to create tables:', error);
    throw error;
  }
}

// ============================================
// Create Indexes
// ============================================

async function createIndexes(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    console.log('[DB] Creating indexes...');

    for (const indexSQL of CREATE_INDEXES) {
      await database.executeSql(indexSQL);
    }

    console.log('[DB] All indexes created successfully');
  } catch (error) {
    console.error('[DB] Failed to create indexes:', error);
    throw error;
  }
}

// ============================================
// Schema Version Management
// ============================================

async function checkAndRunMigrations(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  try {
    // Create schema_version table if it doesn't exist
    await database.executeSql(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);

    // Get current schema version
    const [result] = await database.executeSql(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );

    const currentVersion = result.rows.length > 0 ? result.rows.item(0).version : 0;

    console.log(`[DB] Current schema version: ${currentVersion}`);
    console.log(`[DB] Target schema version: ${SCHEMA_VERSION}`);

    if (currentVersion < SCHEMA_VERSION) {
      console.log('[DB] Running migrations...');
      await runMigrations(database, currentVersion, SCHEMA_VERSION);
    } else {
      console.log('[DB] Schema is up to date');
    }
  } catch (error) {
    console.error('[DB] Failed to check/run migrations:', error);
    throw error;
  }
}

async function runMigrations(
  database: SQLite.SQLiteDatabase,
  fromVersion: number,
  toVersion: number
): Promise<void> {
  // Execute migrations
  await executeMigrations(database, fromVersion, toVersion);

  // Update schema version
  await database.executeSql(
    'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
    [toVersion, Date.now()]
  );

  console.log(`[DB] Migrated from version ${fromVersion} to ${toVersion}`);
}

// ============================================
// Transaction Runner
// ============================================

export interface TransactionExecutor {
  executeSql: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
}

/**
 * Execute a series of database operations atomically with explicit BEGIN / COMMIT / ROLLBACK.
 * Guarantees all-or-nothing execution without promise tick loss.
 */
export async function withTransaction<T>(
  callback: (tx: TransactionExecutor) => Promise<T>
): Promise<T> {
  const database = getDatabase();

  await database.executeSql('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const txExecutor: TransactionExecutor = {
      executeSql: async <R = any>(sql: string, params: any[] = []): Promise<R[]> => {
        const [result] = await database.executeSql(sql, params);
        const rows: R[] = [];
        for (let i = 0; i < result.rows.length; i++) {
          rows.push(result.rows.item(i));
        }
        return rows;
      },
    };

    const result = await callback(txExecutor);
    await database.executeSql('COMMIT;');
    return result;
  } catch (error) {
    try {
      await database.executeSql('ROLLBACK;');
    } catch (rollbackError) {
      console.error('[DB] Rollback failed:', rollbackError);
    }
    console.error('[DB] Transaction failed and rolled back:', error);
    throw error;
  }
}

/**
 * Legacy transaction wrapper maintained for backward compatibility.
 */
export async function executeTransaction<T>(
  callback: (tx: SQLite.Transaction) => Promise<T>
): Promise<T> {
  const database = getDatabase();

  return new Promise((resolve, reject) => {
    database.transaction(
      async (tx) => {
        try {
          const result = await callback(tx);
          resolve(result);
        } catch (error) {
          console.error('[DB] Transaction error:', error);
          reject(error);
        }
      },
      (error) => {
        console.error('[DB] Transaction failed:', error);
        reject(error);
      }
    );
  });
}

// ============================================
// Helper Functions
// ============================================

export async function executeSql<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const database = getDatabase();

  try {
    const [result] = await database.executeSql(sql, params);
    const rows: T[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      rows.push(result.rows.item(i));
    }

    return rows;
  } catch (error) {
    console.error('[DB] SQL execution error:', error);
    console.error('[DB] SQL:', sql);
    console.error('[DB] Params:', params);
    throw error;
  }
}

// ============================================
// Close Database
// ============================================

export async function closeDatabase(): Promise<void> {
  if (db) {
    try {
      await db.close();
      db = null;
      console.log('[DB] Database closed successfully');
    } catch (error) {
      console.error('[DB] Failed to close database:', error);
      throw error;
    }
  }
}

// ============================================
// Delete Database (for testing or reset)
// ============================================

export async function deleteDatabase(): Promise<void> {
  try {
    if (db) {
      await closeDatabase();
    }

    await SQLite.deleteDatabase({
      name: 'wallet.db',
      location: 'default',
    });

    console.log('[DB] Database deleted successfully');
  } catch (error) {
    console.error('[DB] Failed to delete database:', error);
    throw error;
  }
}

// ============================================
// Delete All User Data
// ============================================

export async function deleteAllUserData(): Promise<void> {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    console.log('[DB] Deleting all user data across all 10 tables...');

    // Delete data in strict reverse dependency order inside an atomic transaction
    await withTransaction(async (tx) => {
      await tx.executeSql('DELETE FROM transaction_images;');
      await tx.executeSql('DELETE FROM transactions;');
      await tx.executeSql('DELETE FROM recurring_expenses;');
      await tx.executeSql('DELETE FROM subscriptions;');
      await tx.executeSql('DELETE FROM debts;');
      await tx.executeSql('DELETE FROM goals;');
      await tx.executeSql('DELETE FROM wallets;');
      await tx.executeSql('DELETE FROM categories;');
      await tx.executeSql('DELETE FROM accounts;');
      await tx.executeSql('DELETE FROM users;');
    });

    console.log('[DB] All user data deleted successfully');
  } catch (error) {
    console.error('[DB] Failed to delete all user data:', error);
    throw error;
  }
}

// Export database instance and helper functions
export const database = {
  init: initDatabase,
  close: closeDatabase,
  delete: deleteDatabase,
  deleteAllUserData,
  executeSql,
  withTransaction,
  executeTransaction,
  getDatabase: () => db,
};
