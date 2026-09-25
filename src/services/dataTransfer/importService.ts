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

const IMAGES_DEST = `${RNFS.DocumentDirectoryPath}/transaction-images/originals`;

interface ExportPayload {
  version: string;
  exportedAt: string;
  data: {
    categories: Category[];
    transactions: (Transaction & { images?: string[] })[];
    subscriptions: Subscription[];
    recurringExpenses: RecurringExpense[];
    goals: Goal[];
    debts: Debt[];
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

  let payload: ExportPayload;

  if (isZip) {
    // Read ZIP from disk and parse with JSZip
    const zipBase64 = await RNFS.readFile(filePath, 'base64');
    const zip = await JSZip.loadAsync(zipBase64, { base64: true });

    const dataFile = zip.file('data.json');
    if (!dataFile) throw new Error('Invalid backup: data.json not found inside ZIP');

    const raw = await dataFile.async('string');
    payload = JSON.parse(raw);

    // Extract images
    const imageFiles = Object.keys(zip.files).filter(
      name => name.startsWith('images/') && !zip.files[name].dir
    );

    if (!(await RNFS.exists(IMAGES_DEST))) await RNFS.mkdir(IMAGES_DEST);

    const imported = await importPayload(payload, currentAccountId, currentUserId, async (fileName: string) => {
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
  const jsonPayload = JSON.parse(raw) as ExportPayload;
  const imported = await importPayload(jsonPayload, currentAccountId, currentUserId, null);

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
  payload: ExportPayload,
  currentAccountId: string,
  currentUserId: string,
  resolveImage: ImageResolver
): Promise<Record<string, number>> {
  if (!payload.version || !payload.data) {
    throw new Error('Invalid backup file format');
  }

  const { categories, transactions, subscriptions, recurringExpenses, goals, debts } = payload.data;
  const counts: Record<string, number> = {
    categories: 0,
    transactions: 0,
    subscriptions: 0,
    recurringExpenses: 0,
    goals: 0,
    debts: 0,
  };

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
  for (const c of categories ?? []) {
    const key = `${c.type}|${c.name.toLowerCase()}`;
    const reuseId = byNameType.get(key);
    if (reuseId) {
      categoryIdMap.set(c.id, reuseId);
      // Heal rows that still point at the backup id
      await remapCategoryReferences(c.id, reuseId, currentAccountId);
      continue;
    }
    const alreadyThere = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [c.id]
    );
    if (alreadyThere.length > 0) {
      // Adopt an orphaned category from a previous import/user
      await executeSql(
        'UPDATE categories SET user_id = ?, name = ?, type = ?, icon = ?, color = ? WHERE id = ?',
        [currentUserId, c.name, c.type, c.icon, c.color, c.id]
      );
    } else {
      await executeSql(
        `INSERT INTO categories (id, user_id, name, type, icon, color, is_default, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, currentUserId, c.name, c.type, c.icon, c.color, c.isDefault ? 1 : 0, c.createdAt]
      );
    }
    categoryIdMap.set(c.id, c.id);
    byNameType.set(key, c.id);
    counts.categories += 1;
  }

  // Import transactions + their images (skip ids already present, but heal
  // their category reference so re-importing fixes orphaned rows)
  const knownTxIds = await existingIds('transactions', 'account_id', currentAccountId);
  for (const t of transactions ?? []) {
    const categoryId = categoryIdMap.get(t.categoryId) ?? t.categoryId;
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

    await executeSql(
      `INSERT INTO transactions
       (id, account_id, type, amount, category_id, description, date, vault_type,
        is_recurring, recurring_expense_id, subscription_id, image_path, currency,
        original_amount, exchange_rate, converted_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id, currentAccountId, t.type, t.amount, categoryId, t.description ?? null,
        t.date, t.vaultType, t.isRecurring ? 1 : 0,
        t.recurringExpenseId ?? null, t.subscriptionId ?? null,
        restoredImagePath,
        t.currency ?? 'USD', t.originalAmount ?? null,
        t.exchangeRate ?? null, t.convertedAmount ?? null,
        t.createdAt, t.updatedAt,
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
    const categoryId = categoryIdMap.get(s.categoryId) ?? s.categoryId;
    if (knownSubIds.has(s.id)) {
      await executeSql('UPDATE subscriptions SET category_id = ? WHERE id = ?', [categoryId, s.id]);
      continue;
    }
    await executeSql(
      `INSERT INTO subscriptions
       (id, account_id, name, amount, category_id, billing_day, is_active,
        vault_type, last_processed, next_processing, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id, currentAccountId, s.name, s.amount, categoryId, s.billingDay,
        s.isActive ? 1 : 0, s.vaultType, s.lastProcessed ?? null,
        s.nextProcessing, s.createdAt, s.updatedAt,
      ]
    );
    counts.subscriptions += 1;
  }

  // Import recurring expenses
  const knownRecIds = await existingIds('recurring_expenses', 'account_id', currentAccountId);
  for (const r of recurringExpenses ?? []) {
    const categoryId = categoryIdMap.get(r.categoryId) ?? r.categoryId;
    if (knownRecIds.has(r.id)) {
      await executeSql('UPDATE recurring_expenses SET category_id = ? WHERE id = ?', [categoryId, r.id]);
      continue;
    }
    await executeSql(
      `INSERT INTO recurring_expenses
       (id, account_id, name, amount, category_id, frequency, interval,
        next_occurrence, vault_type, is_active, auto_deduct, last_processed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id, currentAccountId, r.name, r.amount, categoryId, r.frequency,
        r.interval, r.nextOccurrence, r.vaultType, r.isActive ? 1 : 0,
        r.autoDeduct ? 1 : 0, r.lastProcessed ?? null, r.createdAt, r.updatedAt,
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
        g.id, currentAccountId, g.name, g.targetAmount, g.currentAmount,
        g.fundingSource, g.icon, g.color, g.isCompleted ? 1 : 0,
        g.completedAt ?? null, g.createdAt, g.updatedAt,
      ]
    );
    counts.goals += 1;
  }

  // Import debts
  const knownDebtIds = await existingIds('debts', 'account_id', currentAccountId);
  for (const d of debts ?? []) {
    const categoryId = d.categoryId ? (categoryIdMap.get(d.categoryId) ?? d.categoryId) : null;
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
        d.id, currentAccountId, d.type, d.personName, d.amount, d.amountPaid,
        d.dueDate ?? null, d.status, d.description ?? null,
        categoryId, d.createdAt, d.updatedAt,
      ]
    );
    counts.debts += 1;
  }

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
