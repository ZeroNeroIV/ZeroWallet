/**
 * Database Self-Healing and Backward Compatibility Migration Service
 *
 * Automatically detects, repairs, and converts legacy or corrupted data
 * into the latest schema and domain formats:
 * 1. Rescues orphaned transactions/subscriptions/debts by linking them to valid categories.
 * 2. Normalizes legacy vault types ('investment', 'cash', 'bills', null, etc.) to 7-wallet keys.
 * 3. Ensures the 7 built-in wallets exist in the wallets table for all accounts.
 * 4. Fixes null or missing transaction fields (currency, converted_amount).
 * 5. Cleans up broken foreign key references before foreign_keys = ON is enforced.
 * 6. Resynchronizes MMKV account store balances from verified transaction history.
 */

import type SQLite from 'react-native-sqlite-storage';
import { v4 as uuidv4 } from 'uuid';
import { VaultType, VAULT_TYPE_VALUES } from '../domain/vault/VaultType';
import { WALLET_META } from '../utils/wallets';
import { calculateVaultBalances } from '../utils/balanceCalculator';
import { useAccountStore } from '../store/accountStore';
import { useAuthStore } from '../store/authStore';
import type { Transaction } from '../types/models';

export async function healDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[DataHealer] Starting database self-healing pass...');

  try {
    // 1. Ensure basic account/user integrity
    await healUsersAndAccounts(database);

    // 2. Heal categories and orphaned foreign keys
    await healCategoriesAndReferences(database);

    // 3. Heal wallets and normalize vault types
    await healWalletsAndVaultTypes(database);

    // 4. Heal transactions fields
    await healTransactionsData(database);

    // 5. Clean up orphaned child rows
    await cleanOrphanedRows(database);

    // 6. Resynchronize in-memory/MMKV balances from true transaction history
    await resyncBalancesFromTransactions(database);

    console.log('[DataHealer] Database self-healing pass completed successfully');
  } catch (error) {
    console.error('[DataHealer] Error during self-healing pass (non-fatal):', error);
  }
}

/**
 * Ensures existing accounts have a corresponding user and at least one default account.
 */
async function healUsersAndAccounts(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const [userRows] = await database.executeSql('SELECT id FROM users LIMIT 1');
    let fallbackUserId = userRows.rows.length > 0 ? userRows.rows.item(0).id : null;

    if (!fallbackUserId) {
      fallbackUserId = uuidv4();
      const now = Date.now();
      await database.executeSql(
        `INSERT OR IGNORE INTO users (id, email, password_hash, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [fallbackUserId, 'user@zerowallet.local', '', 'Default User', now, now]
      );
    }

    // Link any accounts with null/empty user_id to the fallback user
    await database.executeSql(
      'UPDATE accounts SET user_id = ? WHERE user_id IS NULL OR user_id = ?',
      [fallbackUserId, '']
    );

    // If no account exists, create a default account
    const [accountRows] = await database.executeSql('SELECT id FROM accounts LIMIT 1');
    if (accountRows.rows.length === 0) {
      const defaultAccountId = uuidv4();
      const now = Date.now();
      await database.executeSql(
        `INSERT OR IGNORE INTO accounts (id, user_id, name, currency, icon, color, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [defaultAccountId, fallbackUserId, 'Main Wallet', 'USD', 'wallet', '#007AFF', now, now]
      );
      useAuthStore.getState().setCurrentAccountId(defaultAccountId);
      useAccountStore.getState().setCurrentAccountId(defaultAccountId);
    }
  } catch (err) {
    console.warn('[DataHealer] healUsersAndAccounts warning:', err);
  }
}

/**
 * Ensures all transactions, subscriptions, recurring expenses, and debts
 * point to valid categories so foreign key constraints are 100% satisfied.
 */
async function healCategoriesAndReferences(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const now = Date.now();

    // Find all distinct users with accounts
    const [userRows] = await database.executeSql('SELECT DISTINCT id FROM users');
    const userIds: string[] = [];
    for (let i = 0; i < userRows.rows.length; i++) {
      userIds.push(userRows.rows.item(i).id);
    }

    // Ensure each user has a fallback "General" category for expenses and income
    const userFallbackCategoryMap: Record<string, string> = {};

    for (const userId of userIds) {
      const [catRows] = await database.executeSql(
        `SELECT id FROM categories WHERE user_id = ? AND type = 'expense' LIMIT 1`,
        [userId]
      );

      if (catRows.rows.length > 0) {
        userFallbackCategoryMap[userId] = catRows.rows.item(0).id;
      } else {
        const newCatId = uuidv4();
        await database.executeSql(
          `INSERT OR IGNORE INTO categories (id, user_id, name, type, icon, color, is_default, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [newCatId, userId, 'General', 'expense', 'tag', '#607D8B', now, now]
        );
        userFallbackCategoryMap[userId] = newCatId;
      }
    }

    // Default system fallback category if user map doesn't catch it
    const defaultUserId = userIds[0] || 'default_user';
    const systemFallbackCatId = userFallbackCategoryMap[defaultUserId] || uuidv4();
    if (!userFallbackCategoryMap[defaultUserId]) {
      await database.executeSql(
        `INSERT OR IGNORE INTO categories (id, user_id, name, type, icon, color, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [systemFallbackCatId, defaultUserId, 'General', 'expense', 'tag', '#607D8B', now, now]
      );
    }

    // Heal orphaned transactions: re-link category_id to valid category
    const [orphanedTx] = await database.executeSql(`
      SELECT t.id, a.user_id, t.type
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.category_id NOT IN (SELECT id FROM categories)
    `);

    for (let i = 0; i < orphanedTx.rows.length; i++) {
      const row = orphanedTx.rows.item(i);
      const targetCatId = userFallbackCategoryMap[row.user_id] || systemFallbackCatId;
      await database.executeSql('UPDATE transactions SET category_id = ? WHERE id = ?', [
        targetCatId,
        row.id,
      ]);
    }

    // Heal orphaned subscriptions
    const [orphanedSubs] = await database.executeSql(`
      SELECT s.id, a.user_id
      FROM subscriptions s
      LEFT JOIN accounts a ON s.account_id = a.id
      WHERE s.category_id NOT IN (SELECT id FROM categories)
    `);

    for (let i = 0; i < orphanedSubs.rows.length; i++) {
      const row = orphanedSubs.rows.item(i);
      const targetCatId = userFallbackCategoryMap[row.user_id] || systemFallbackCatId;
      await database.executeSql('UPDATE subscriptions SET category_id = ? WHERE id = ?', [
        targetCatId,
        row.id,
      ]);
    }

    // Heal orphaned recurring expenses
    const [orphanedRec] = await database.executeSql(`
      SELECT r.id, a.user_id
      FROM recurring_expenses r
      LEFT JOIN accounts a ON r.account_id = a.id
      WHERE r.category_id NOT IN (SELECT id FROM categories)
    `);

    for (let i = 0; i < orphanedRec.rows.length; i++) {
      const row = orphanedRec.rows.item(i);
      const targetCatId = userFallbackCategoryMap[row.user_id] || systemFallbackCatId;
      await database.executeSql('UPDATE recurring_expenses SET category_id = ? WHERE id = ?', [
        targetCatId,
        row.id,
      ]);
    }

    // Heal orphaned debts: set category_id to NULL
    await database.executeSql(`
      UPDATE debts
      SET category_id = NULL
      WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM categories)
    `);
  } catch (err) {
    console.warn('[DataHealer] healCategoriesAndReferences warning:', err);
  }
}

/**
 * Normalizes legacy vault types in all relevant tables and ensures built-in wallets exist.
 */
async function healWalletsAndVaultTypes(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const now = Date.now();

    // 1. Ensure the 7 default wallets exist for each account in the wallets table
    const [accRows] = await database.executeSql('SELECT id FROM accounts');
    for (let i = 0; i < accRows.rows.length; i++) {
      const accountId = accRows.rows.item(i).id;
      for (const key of VAULT_TYPE_VALUES) {
        const meta = WALLET_META[key as keyof typeof WALLET_META];
        if (!meta) continue;
        await database.executeSql(
          `INSERT OR IGNORE INTO wallets (id, account_id, name, icon, color, is_default, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
          [key, accountId, meta.name, meta.icon, '#007AFF', now, now]
        );
      }
    }

    // 2. Normalize legacy or alias vault types in transactions
    const normalizations: [string[], string][] = [
      [['investment', 'invest', 'spending', 'general', 'MAIN'], 'main'],
      [['recurring', 'bills', 'HELD'], 'held'],
      [['SAVINGS'], 'savings'],
      [['emergency_fund', 'emergency-fund', 'EMERGENCY'], 'emergency'],
      [['cash', 'PHYSICAL'], 'physical'],
      [['credit', 'debit', 'credit_card', 'credit-card', 'CARD'], 'card'],
      [['SALARY'], 'salary'],
    ];

    for (const [legacyValues, targetKey] of normalizations) {
      const placeholders = legacyValues.map(() => '?').join(', ');
      await database.executeSql(
        `UPDATE transactions SET vault_type = ? WHERE vault_type IN (${placeholders})`,
        [targetKey, ...legacyValues]
      );
      await database.executeSql(
        `UPDATE subscriptions SET vault_type = ? WHERE vault_type IN (${placeholders})`,
        [targetKey, ...legacyValues]
      );
      await database.executeSql(
        `UPDATE recurring_expenses SET vault_type = ? WHERE vault_type IN (${placeholders})`,
        [targetKey, ...legacyValues]
      );
    }

    // Default any NULL or empty vault_type to 'main'
    await database.executeSql(
      "UPDATE transactions SET vault_type = 'main' WHERE vault_type IS NULL OR vault_type = ''"
    );
    await database.executeSql(
      "UPDATE subscriptions SET vault_type = 'main' WHERE vault_type IS NULL OR vault_type = ''"
    );
    await database.executeSql(
      "UPDATE recurring_expenses SET vault_type = 'main' WHERE vault_type IS NULL OR vault_type = ''"
    );

    // 3. Register any custom wallet IDs used by transactions into the wallets table
    const [customTxRows] = await database.executeSql(`
      SELECT DISTINCT t.vault_type, t.account_id
      FROM transactions t
      WHERE t.vault_type NOT IN (SELECT id FROM wallets)
    `);

    for (let i = 0; i < customTxRows.rows.length; i++) {
      const { vault_type, account_id } = customTxRows.rows.item(i);
      if (vault_type && account_id) {
        const prettyName =
          vault_type.charAt(0).toUpperCase() + vault_type.slice(1) + ' Wallet';
        await database.executeSql(
          `INSERT OR IGNORE INTO wallets (id, account_id, name, icon, color, is_default, created_at, updated_at)
           VALUES (?, ?, ?, 'wallet', '#607D8B', 0, ?, ?)`,
          [vault_type, account_id, prettyName, now, now]
        );
      }
    }
  } catch (err) {
    console.warn('[DataHealer] healWalletsAndVaultTypes warning:', err);
  }
}

/**
 * Normalizes missing or NULL transaction columns.
 */
async function healTransactionsData(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    // Fill missing currencies
    await database.executeSql(
      "UPDATE transactions SET currency = 'USD' WHERE currency IS NULL OR currency = ''"
    );

    // Fill missing converted_amount
    await database.executeSql(
      'UPDATE transactions SET converted_amount = amount WHERE converted_amount IS NULL'
    );
  } catch (err) {
    console.warn('[DataHealer] healTransactionsData warning:', err);
  }
}

/**
 * Removes dangling child rows whose parents were deleted in earlier versions.
 */
async function cleanOrphanedRows(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await database.executeSql(
      'DELETE FROM transaction_images WHERE transaction_id NOT IN (SELECT id FROM transactions)'
    );
  } catch (err) {
    console.warn('[DataHealer] cleanOrphanedRows warning:', err);
  }
}

/**
 * Recalculates accurate vault balances from verified transactions for every account
 * and updates Zustand / MMKV accountStore so users never see zero or NaN balances.
 */
async function resyncBalancesFromTransactions(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const [accRows] = await database.executeSql('SELECT id, is_default FROM accounts');
    const accountStore = useAccountStore.getState();
    const authStore = useAuthStore.getState();

    let defaultAccountId: string | null = null;

    for (let i = 0; i < accRows.rows.length; i++) {
      const acc = accRows.rows.item(i);
      if (acc.is_default === 1 || !defaultAccountId) {
        defaultAccountId = acc.id;
      }

      // Query transactions for this account
      const [txRows] = await database.executeSql(
        'SELECT * FROM transactions WHERE account_id = ?',
        [acc.id]
      );

      const transactions: Transaction[] = [];
      for (let j = 0; j < txRows.rows.length; j++) {
        const r = txRows.rows.item(j);
        transactions.push({
          id: r.id,
          accountId: r.account_id,
          type: r.type,
          amount: Number(r.amount) || 0,
          categoryId: r.category_id,
          description: r.description,
          date: Number(r.date) || 0,
          vaultType: r.vault_type,
          isRecurring: r.is_recurring === 1,
          currency: r.currency || 'USD',
          convertedAmount:
            r.converted_amount !== null && r.converted_amount !== undefined
              ? Number(r.converted_amount)
              : Number(r.amount) || 0,
          createdAt: Number(r.created_at) || 0,
          updatedAt: Number(r.updated_at) || 0,
        });
      }

      const calculated = calculateVaultBalances(transactions);
      accountStore.updateBalance(acc.id, calculated);
    }

    // Ensure active accountId is set in both stores
    if (!accountStore.currentAccountId && defaultAccountId) {
      accountStore.setCurrentAccountId(defaultAccountId);
    }
    if (!authStore.currentAccountId && defaultAccountId) {
      authStore.setCurrentAccountId(defaultAccountId);
    }
  } catch (err) {
    console.warn('[DataHealer] resyncBalancesFromTransactions warning:', err);
  }
}
