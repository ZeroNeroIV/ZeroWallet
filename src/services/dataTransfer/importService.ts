import RNFS from 'react-native-fs';
import { pick, keepLocalCopy } from '@react-native-documents/picker';
import JSZip from 'jszip';
import { executeSql } from '../../database';
import type {
  Category,
  Transaction,
  Subscription,
  RecurringExpense,
  Goal,
  Debt,
} from '../../types/models';

import { v4 as uuidv4 } from 'uuid';
import { VaultType } from '../../domain/vault/VaultType';
import { calculateVaultBalances } from '../../utils/balanceCalculator';
import { useAccountStore } from '../../store/accountStore';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';

const IMAGES_DEST = `${RNFS.DocumentDirectoryPath}/transaction-images/originals`;

interface ExportPayload {
  version?: string;
  exportedAt?: string;
  data: {
    categories?: Category[];
    transactions?: (Transaction & { images?: string[] })[];
    subscriptions?: Subscription[];
    recurringExpenses?: RecurringExpense[];
    goals?: Goal[];
    debts?: Debt[];
    wallets?: any[];
  };
}

/**
 * Normalizes any legacy, unversioned, or raw JSON backup payload
 * into the standard ExportPayload shape.
 */
function normalizeBackupPayload(raw: any): ExportPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid backup file: file content is not an object');
  }

  // Handle payload without .data envelope (legacy format where arrays are top-level)
  const data = raw.data && typeof raw.data === 'object' ? raw.data : raw;
  const version = raw.version || '1.0';
  const exportedAt = raw.exportedAt || new Date().toISOString();

  return {
    version,
    exportedAt,
    data: {
      categories: Array.isArray(data.categories) ? data.categories : [],
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
      recurringExpenses: Array.isArray(data.recurringExpenses) ? data.recurringExpenses : [],
      goals: Array.isArray(data.goals) ? data.goals : [],
      debts: Array.isArray(data.debts) ? data.debts : [],
      wallets: Array.isArray(data.wallets) ? data.wallets : [],
    },
  };
}

export async function pickAndImportData(
  currentAccountId: string,
  currentUserId: string,
): Promise<{
  imported: Record<string, number>;
}> {
  const [result] = await pick({ allowMultiSelection: false });

  // Copy to local cache so RNFS can access it
  const [localCopy] = await keepLocalCopy({
    files: [{ uri: result.uri, fileName: result.name ?? 'backup' }],
    destination: 'cachesDirectory',
  });

  if (localCopy.status === 'error') {
    throw new Error(localCopy.copyError ?? 'Failed to copy file');
  }

  const filePath = decodeURIComponent(localCopy.localUri.replace('file://', ''));
  const isZip = (result.name ?? filePath).toLowerCase().endsWith('.zip') ||
    (result.type ?? '').includes('zip');

  let rawPayload: any;

  if (isZip) {
    // Read ZIP from disk and parse with JSZip
    const zipBase64 = await RNFS.readFile(filePath, 'base64');
    const zip = await JSZip.loadAsync(zipBase64, { base64: true });

    const dataFile = zip.file('data.json');
    if (!dataFile) throw new Error('Invalid backup: data.json not found inside ZIP');

    const raw = await dataFile.async('string');
    rawPayload = JSON.parse(raw);

    // Extract images
    const imageFiles = Object.keys(zip.files).filter(
      name => name.startsWith('images/') && !zip.files[name].dir
    );

    if (!(await RNFS.exists(IMAGES_DEST))) await RNFS.mkdir(IMAGES_DEST);

    const imported = await importPayload(rawPayload, currentAccountId, currentUserId, async (fileName: string) => {
      const zipEntry = zip.file(`images/${fileName}`);
      if (!zipEntry) return null;
      const destPath = `${IMAGES_DEST}/${fileName}`;
      if (!(await RNFS.exists(destPath))) {
        const imgBase64 = await zipEntry.async('base64');
        await RNFS.writeFile(destPath, imgBase64, 'base64');
      }
      return (await RNFS.exists(destPath)) ? destPath : null;
    });

    // Also restore any images not referenced by transactions
    for (const name of imageFiles) {
      const fileName = name.replace('images/', '');
      const destPath = `${IMAGES_DEST}/${fileName}`;
      if (!(await RNFS.exists(destPath))) {
        const zipEntry = zip.file(name)!;
        const imgBase64 = await zipEntry.async('base64');
        await RNFS.writeFile(destPath, imgBase64, 'base64');
      }
    }
    return { imported };
  }

  // Legacy plain JSON backup
  const raw = await RNFS.readFile(filePath, 'utf8');
  rawPayload = JSON.parse(raw);
  const imported = await importPayload(rawPayload, currentAccountId, currentUserId, null);

  return { imported };
}

type ImageResolver = ((fileName: string) => Promise<string | null>) | null;

async function existingIds(table: string, ownerColumn: string, ownerId: string): Promise<Set<string>> {
  const rows = await executeSql<{ id: string }>(
    `SELECT id FROM ${table} WHERE ${ownerColumn} = ?`,
    [ownerId]
  );
  return new Set(rows.map((r) => r.id));
}

async function importPayload(
  rawInput: any,
  currentAccountId: string,
  currentUserId: string,
  resolveImage: ImageResolver
): Promise<Record<string, number>> {
  const payload = normalizeBackupPayload(rawInput);

  const { categories, transactions, subscriptions, recurringExpenses, goals, debts, wallets } = payload.data;
  const counts: Record<string, number> = {
    categories: 0,
    transactions: 0,
    subscriptions: 0,
    recurringExpenses: 0,
    goals: 0,
    debts: 0,
  };

  // Ensure default wallets exist for the account
  await new WalletRepository().ensureDefaultWallets(currentAccountId);

  // Import custom wallets if any
  for (const w of wallets ?? []) {
    if (w.id && w.name) {
      await executeSql(
        `INSERT OR IGNORE INTO wallets (id, account_id, name, icon, color, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [w.id, currentAccountId, w.name, w.icon || 'wallet', w.color || '#007AFF', w.isDefault ? 1 : 0, w.createdAt || Date.now(), w.updatedAt || Date.now()]
      );
    }
  }

  // Import categories: adopt them to the current user and map backup ids
  // to usable ids (reusing an existing same-name category when present so
  // no duplicates or orphaned category references are left behind).
  const categoryIdMap = new Map<string, string>();
  const knownCategories = await executeSql<{ id: string; name: string; type: string }>(
    'SELECT id, name, type FROM categories WHERE user_id = ?',
    [currentUserId]
  );
  const byNameType = new Map(
    knownCategories.map((c) => [`${c.type}|${c.name.toLowerCase()}`, c.id])
  );

  let defaultCategoryId: string | null = knownCategories[0]?.id || null;

  for (const c of categories ?? []) {
    const catType = c.type === 'income' ? 'income' : 'expense';
    const catName = c.name || 'General';
    const key = `${catType}|${catName.toLowerCase()}`;
    const reuseId = byNameType.get(key);
    if (reuseId) {
      categoryIdMap.set(c.id, reuseId);
      if (!defaultCategoryId) defaultCategoryId = reuseId;
      await remapCategoryReferences(c.id, reuseId, currentAccountId);
      continue;
    }
    const alreadyThere = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [c.id]
    );
    if (alreadyThere.length > 0) {
      await executeSql(
        'UPDATE categories SET user_id = ?, name = ?, type = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?',
        [currentUserId, catName, catType, c.icon || 'tag', c.color || '#607D8B', Date.now(), c.id]
      );
    } else {
      await executeSql(
        `INSERT INTO categories (id, user_id, name, type, icon, color, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, currentUserId, catName, catType, c.icon || 'tag', c.color || '#607D8B', c.isDefault ? 1 : 0, c.createdAt || Date.now(), c.createdAt || Date.now()]
      );
    }
    categoryIdMap.set(c.id, c.id);
    byNameType.set(key, c.id);
    if (!defaultCategoryId) defaultCategoryId = c.id;
    counts.categories += 1;
  }

  // If user still has no category at all, create a default fallback
  if (!defaultCategoryId) {
    defaultCategoryId = uuidv4();
    const now = Date.now();
    await executeSql(
      `INSERT OR IGNORE INTO categories (id, user_id, name, type, icon, color, is_default, created_at, updated_at)
       VALUES (?, ?, 'General', 'expense', 'tag', '#607D8B', 1, ?, ?)`,
      [defaultCategoryId, currentUserId, now, now]
    );
  }

  // Import transactions + their images (skip ids already present, but heal
  // their category reference so re-importing fixes orphaned rows)
  const knownTxIds = await existingIds('transactions', 'account_id', currentAccountId);
  for (const t of transactions ?? []) {
    let categoryId = categoryIdMap.get(t.categoryId) ?? t.categoryId;

    // Validate that categoryId actually exists in the categories table
    const catCheck = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId]
    );
    if (catCheck.length === 0) {
      // Re-link to default category to prevent foreign key violation
      categoryId = defaultCategoryId;
    }

    if (knownTxIds.has(t.id)) {
      await executeSql('UPDATE transactions SET category_id = ? WHERE id = ?', [categoryId, t.id]);
      continue;
    }

    const newImagePaths: string[] = [];

    if (resolveImage && t.images?.length) {
      for (const oldPath of t.images) {
        const fileName = oldPath.replace('file://', '').split('/').pop()!;
        const destPath = await resolveImage(fileName);
        if (destPath) newImagePaths.push(destPath);
      }
    }

    // Remap legacy imagePath
    let restoredImagePath = t.imagePath ?? null;
    if (resolveImage && t.imagePath) {
      const fileName = t.imagePath.replace('file://', '').split('/').pop()!;
      restoredImagePath = await resolveImage(fileName);
    }

    const normalizedVaultType = VaultType.parse(t.vaultType).type;
    const amount = Number(t.amount) || 0;
    const convertedAmount =
      t.convertedAmount !== null && t.convertedAmount !== undefined
        ? Number(t.convertedAmount)
        : amount;
    const txType = t.type === 'income' ? 'income' : 'expense';
    const txDate = Number(t.date) || Date.now();
    const createdAt = Number(t.createdAt) || txDate;
    const updatedAt = Number(t.updatedAt) || createdAt;

    await executeSql(
      `INSERT INTO transactions
       (id, account_id, type, amount, category_id, description, date, vault_type,
        is_recurring, recurring_expense_id, subscription_id, image_path, currency,
        original_amount, exchange_rate, converted_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id, currentAccountId, txType, amount, categoryId, t.description ?? null,
        txDate, normalizedVaultType, t.isRecurring ? 1 : 0,
        t.recurringExpenseId ?? null, t.subscriptionId ?? null,
        restoredImagePath,
        t.currency ?? 'USD', t.originalAmount ?? null,
        t.exchangeRate ?? null, convertedAmount,
        createdAt, updatedAt,
      ]
    );
    counts.transactions += 1;

    for (let i = 0; i < newImagePaths.length; i++) {
      const id = `${t.id}-img-${i}`;
      await executeSql(
        `INSERT OR IGNORE INTO transaction_images (id, transaction_id, image_path, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, t.id, newImagePaths[i], i, Date.now()]
      );
    }
  }

  // Import subscriptions
  const knownSubIds = await existingIds('subscriptions', 'account_id', currentAccountId);
  for (const s of subscriptions ?? []) {
    let categoryId = categoryIdMap.get(s.categoryId) ?? s.categoryId;
    const catCheck = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId]
    );
    if (catCheck.length === 0) categoryId = defaultCategoryId;

    if (knownSubIds.has(s.id)) {
      await executeSql('UPDATE subscriptions SET category_id = ? WHERE id = ?', [categoryId, s.id]);
      continue;
    }

    const normalizedVaultType = VaultType.parse(s.vaultType).type;

    await executeSql(
      `INSERT INTO subscriptions
       (id, account_id, name, amount, category_id, billing_day, is_active,
        vault_type, last_processed, next_processing, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id, currentAccountId, s.name, Number(s.amount) || 0, categoryId, Number(s.billingDay) || 1,
        s.isActive ? 1 : 0, normalizedVaultType, s.lastProcessed ?? null,
        Number(s.nextProcessing) || Date.now(), Number(s.createdAt) || Date.now(), Number(s.updatedAt) || Date.now(),
      ]
    );
    counts.subscriptions += 1;
  }

  // Import recurring expenses
  const knownRecIds = await existingIds('recurring_expenses', 'account_id', currentAccountId);
  for (const r of recurringExpenses ?? []) {
    let categoryId = categoryIdMap.get(r.categoryId) ?? r.categoryId;
    const catCheck = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId]
    );
    if (catCheck.length === 0) categoryId = defaultCategoryId;

    if (knownRecIds.has(r.id)) {
      await executeSql('UPDATE recurring_expenses SET category_id = ? WHERE id = ?', [categoryId, r.id]);
      continue;
    }

    const normalizedVaultType = VaultType.parse(r.vaultType).type;

    await executeSql(
      `INSERT INTO recurring_expenses
       (id, account_id, name, amount, category_id, frequency, interval,
        next_occurrence, vault_type, is_active, auto_deduct, last_processed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id, currentAccountId, r.name, Number(r.amount) || 0, categoryId, r.frequency || 'monthly',
        Number(r.interval) || 1, Number(r.nextOccurrence) || Date.now(), normalizedVaultType, r.isActive ? 1 : 0,
        r.autoDeduct ? 1 : 0, r.lastProcessed ?? null, Number(r.createdAt) || Date.now(), Number(r.updatedAt) || Date.now(),
      ]
    );
    counts.recurringExpenses += 1;
  }

  // Import goals
  const knownGoalIds = await existingIds('goals', 'account_id', currentAccountId);
  for (const g of goals ?? []) {
    if (knownGoalIds.has(g.id)) continue;
    await executeSql(
      `INSERT INTO goals
       (id, account_id, name, target_amount, current_amount, funding_source,
        icon, color, is_completed, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        g.id, currentAccountId, g.name, g.targetAmount !== null ? Number(g.targetAmount) : null,
        Number(g.currentAmount) || 0, g.fundingSource || 'main', g.icon || 'flag', g.color || '#007AFF',
        g.isCompleted ? 1 : 0, g.completedAt ?? null, Number(g.createdAt) || Date.now(), Number(g.updatedAt) || Date.now(),
      ]
    );
    counts.goals += 1;
  }

  // Import debts
  const knownDebtIds = await existingIds('debts', 'account_id', currentAccountId);
  for (const d of debts ?? []) {
    let categoryId = d.categoryId ? (categoryIdMap.get(d.categoryId) ?? d.categoryId) : null;
    if (categoryId) {
      const catCheck = await executeSql<{ id: string }>(
        'SELECT id FROM categories WHERE id = ?',
        [categoryId]
      );
      if (catCheck.length === 0) categoryId = null;
    }

    if (knownDebtIds.has(d.id)) {
      if (d.categoryId) {
        await executeSql('UPDATE debts SET category_id = ? WHERE id = ?', [categoryId, d.id]);
      }
      continue;
    }

    await executeSql(
      `INSERT INTO debts
       (id, account_id, type, person_name, amount, amount_paid, due_date,
        status, description, category_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.id, currentAccountId, d.type || 'lent', d.personName || 'Unknown',
        Number(d.amount) || 0, Number(d.amountPaid) || 0,
        d.dueDate ? Number(d.dueDate) : null, d.status || 'pending', d.description ?? null,
        categoryId, Number(d.createdAt) || Date.now(), Number(d.updatedAt) || Date.now(),
      ]
    );
    counts.debts += 1;
  }

  // Resynchronize account balances after import
  const allTx = await new TransactionRepository().findByAccount(currentAccountId);
  const updatedBalances = calculateVaultBalances(allTx);
  useAccountStore.getState().updateBalance(currentAccountId, updatedBalances);

  return counts;
}

/**
 * Purpose: Point every row that still references an old backup category id
 * at the usable category id, healing orphaned references from earlier
 * imports (re-importing the same backup repairs the data).
 */
async function remapCategoryReferences(
  oldCategoryId: string,
  newCategoryId: string,
  accountId: string
): Promise<void> {
  if (oldCategoryId === newCategoryId) return;
  await executeSql('UPDATE transactions SET category_id = ? WHERE account_id = ? AND category_id = ?', [
    newCategoryId,
    accountId,
    oldCategoryId,
  ]);
  await executeSql('UPDATE subscriptions SET category_id = ? WHERE account_id = ? AND category_id = ?', [
    newCategoryId,
    accountId,
    oldCategoryId,
  ]);
  await executeSql(
    'UPDATE recurring_expenses SET category_id = ? WHERE account_id = ? AND category_id = ?',
    [newCategoryId, accountId, oldCategoryId]
  );
  await executeSql('UPDATE debts SET category_id = ? WHERE account_id = ? AND category_id = ?', [
    newCategoryId,
    accountId,
    oldCategoryId,
  ]);
}
