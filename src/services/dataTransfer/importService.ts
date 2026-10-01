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
import { WALLET_META } from '../../utils/wallets';
import { formatWalletName } from '../../database/dataHealer';
import { useSettingsStore } from '../../store/settingsStore';

const IMAGES_DEST = `${RNFS.DocumentDirectoryPath}/transaction-images/originals`;

interface ExportPayload {
  version?: string;
  exportedAt?: string;
  data: {
    account?: any;
    categories?: Category[];
    transactions?: (Transaction & { images?: string[] })[];
    subscriptions?: Subscription[];
    recurringExpenses?: RecurringExpense[];
    goals?: Goal[];
    debts?: Debt[];
    wallets?: any[];
    budgets?: any[];
    salarySettings?: any;
    notificationSettings?: any;
    appSettings?: any;
    securitySettings?: any;
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
      account: data.account ?? null,
      categories: Array.isArray(data.categories) ? data.categories : [],
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
      recurringExpenses: Array.isArray(data.recurringExpenses ?? data.recurring_expenses)
        ? (data.recurringExpenses ?? data.recurring_expenses)
        : [],
      goals: Array.isArray(data.goals) ? data.goals : [],
      debts: Array.isArray(data.debts) ? data.debts : [],
      wallets: Array.isArray(data.wallets) ? data.wallets : [],
      budgets: Array.isArray(data.budgets) ? data.budgets : [],
      salarySettings: data.salarySettings && typeof data.salarySettings === 'object' ? data.salarySettings : null,
      notificationSettings:
        data.notificationSettings && typeof data.notificationSettings === 'object'
          ? data.notificationSettings
          : null,
      appSettings: data.appSettings && typeof data.appSettings === 'object' ? data.appSettings : null,
      securitySettings:
        data.securitySettings && typeof data.securitySettings === 'object' ? data.securitySettings : null,
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

export async function importPayload(
  rawInput: any,
  currentAccountId: string,
  currentUserId: string,
  resolveImage: ImageResolver = null,
): Promise<Record<string, number>> {
  const payload = normalizeBackupPayload(rawInput);

  const {
    account,
    categories,
    transactions,
    subscriptions,
    recurringExpenses,
    goals,
    debts,
    wallets,
    budgets,
    salarySettings,
    notificationSettings,
    appSettings,
    securitySettings,
  } = payload.data;
  const counts: Record<string, number> = {
    account: 0,
    categories: 0,
    wallets: 0,
    transactions: 0,
    subscriptions: 0,
    recurringExpenses: 0,
    goals: 0,
    debts: 0,
    budgets: 0,
  };

  const walletRepo = new WalletRepository();
  const now = Date.now();

  // 0. Import or update account details if present in payload
  const rawAccount = account as Record<string, any> | null;
  if (rawAccount && typeof rawAccount === 'object') {
    const accName = rawAccount.name || 'My Wallet';
    const accCurrency = rawAccount.currency || 'USD';
    const accIcon = rawAccount.icon || 'wallet';
    const accColor = rawAccount.color || '#4ECDC4';

    const existingAcc = await executeSql<{ id: string }>(
      'SELECT id FROM accounts WHERE id = ?',
      [currentAccountId]
    );

    if (existingAcc.length > 0) {
      await executeSql(
        `UPDATE accounts SET name = ?, currency = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?`,
        [accName, accCurrency, accIcon, accColor, now, currentAccountId]
      );
    } else {
      await executeSql(
        `INSERT INTO accounts (id, user_id, name, currency, icon, color, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           currency = excluded.currency,
           icon = excluded.icon,
           color = excluded.color,
           updated_at = excluded.updated_at`,
        [currentAccountId, currentUserId, accName, accCurrency, accIcon, accColor, now, now]
      );
    }
    counts.account = 1;
  }

  // 1. Ensure built-in default wallets exist for the account
  await walletRepo.ensureDefaultWallets(currentAccountId);

  // 2. Import explicit wallets from payload if present
  for (const w of wallets ?? []) {
    const raw = w as Record<string, any>;
    const wId = raw.id;
    const wName = raw.name;
    if (!wId || !wName) continue;
    const isDefault =
      raw.isDefault !== undefined
        ? (raw.isDefault ? 1 : 0)
        : (raw.is_default !== undefined ? (raw.is_default ? 1 : 0) : 0);
    const icon = raw.icon || 'wallet';
    const color = raw.color || '#007AFF';
    const createdAt = Number(raw.createdAt ?? raw.created_at) || now;
    const updatedAt = Number(raw.updatedAt ?? raw.updated_at) || createdAt;

    await executeSql(
      `INSERT INTO wallets (id, account_id, name, icon, color, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id, account_id) DO UPDATE SET
         name = excluded.name,
         icon = excluded.icon,
         color = excluded.color,
         updated_at = excluded.updated_at`,
      [wId, currentAccountId, wName, icon, color, isDefault, createdAt, updatedAt]
    );
  }

  // 3. Auto-discover all vault types referenced in transactions, subscriptions, and recurring expenses
  // (handles legacy exports where wallets array did not exist or snake_case vault_type was used)
  const referencedVaultTypes = new Set<string>();
  for (const t of transactions ?? []) {
    const raw = (t as any).vaultType ?? (t as any).vault_type;
    if (raw) referencedVaultTypes.add(VaultType.parse(raw).type);
  }
  for (const s of subscriptions ?? []) {
    const raw = (s as any).vaultType ?? (s as any).vault_type;
    if (raw) referencedVaultTypes.add(VaultType.parse(raw).type);
  }
  for (const r of recurringExpenses ?? []) {
    const raw = (r as any).vaultType ?? (r as any).vault_type;
    if (raw) referencedVaultTypes.add(VaultType.parse(raw).type);
  }

  const existingWallets = await walletRepo.findByAccount(currentAccountId);
  const existingWalletIds = new Set(existingWallets.map((w) => w.id));

  for (const vType of referencedVaultTypes) {
    if (!vType || existingWalletIds.has(vType)) continue;
    const meta = WALLET_META[vType as keyof typeof WALLET_META];
    const isBuiltIn = !!meta;
    const name = isBuiltIn ? meta.name : formatWalletName(vType);
    const icon = isBuiltIn ? meta.icon : 'wallet';
    const color = isBuiltIn ? meta.color : '#007AFF';

    await executeSql(
      `INSERT OR IGNORE INTO wallets (id, account_id, name, icon, color, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [vType, currentAccountId, name, icon, color, isBuiltIn ? 1 : 0, now, now]
    );
    existingWalletIds.add(vType);
  }

  const finalWallets = await walletRepo.findByAccount(currentAccountId);
  counts.wallets = finalWallets.length;

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
    const raw = c as Record<string, any>;
    const catId = raw.id;
    if (!catId) continue;
    const catType = raw.type === 'income' ? 'income' : 'expense';
    const catName = raw.name || 'General';
    const icon = raw.icon || 'tag';
    const color = raw.color || '#607D8B';
    const isDefault = (raw.isDefault ?? raw.is_default) ? 1 : 0;
    const createdAt = Number(raw.createdAt ?? raw.created_at) || now;
    const updatedAt = Number(raw.updatedAt ?? raw.updated_at) || createdAt;

    const key = `${catType}|${catName.toLowerCase()}`;
    const reuseId = byNameType.get(key);
    if (reuseId) {
      categoryIdMap.set(catId, reuseId);
      if (!defaultCategoryId) defaultCategoryId = reuseId;
      await remapCategoryReferences(catId, reuseId, currentAccountId);
      continue;
    }
    const alreadyThere = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [catId]
    );
    if (alreadyThere.length > 0) {
      await executeSql(
        'UPDATE categories SET user_id = ?, name = ?, type = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?',
        [currentUserId, catName, catType, icon, color, updatedAt, catId]
      );
    } else {
      await executeSql(
        `INSERT INTO categories (id, user_id, name, type, icon, color, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [catId, currentUserId, catName, catType, icon, color, isDefault, createdAt, updatedAt]
      );
    }
    categoryIdMap.set(catId, catId);
    byNameType.set(key, catId);
    if (!defaultCategoryId) defaultCategoryId = catId;
    counts.categories += 1;
  }

  // If user still has no category at all, create a default fallback
  if (!defaultCategoryId) {
    defaultCategoryId = uuidv4();
    await executeSql(
      `INSERT OR IGNORE INTO categories (id, user_id, name, type, icon, color, is_default, created_at, updated_at)
       VALUES (?, ?, 'General', 'expense', 'tag', '#607D8B', 1, ?, ?)`,
      [defaultCategoryId, currentUserId, now, now]
    );
  }

  // Import transactions + their images (ON CONFLICT resilient to heal existing rows)
  for (const t of transactions ?? []) {
    const raw = t as Record<string, any>;
    const tId = raw.id;
    if (!tId) continue;

    const rawCatId = raw.categoryId ?? raw.category_id;
    let categoryId = categoryIdMap.get(rawCatId) ?? rawCatId;

    // Validate that categoryId actually exists in the categories table
    const catCheck = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId]
    );
    if (catCheck.length === 0) {
      categoryId = defaultCategoryId;
    }

    const newImagePaths: string[] = [];

    if (resolveImage && raw.images?.length) {
      for (const oldPath of raw.images) {
        const fileName = oldPath.replace('file://', '').split('/').pop()!;
        const destPath = await resolveImage(fileName);
        if (destPath) newImagePaths.push(destPath);
      }
    }

    // Remap legacy imagePath
    let restoredImagePath = (raw.imagePath ?? raw.image_path) ?? null;
    if (resolveImage && restoredImagePath) {
      const fileName = restoredImagePath.replace('file://', '').split('/').pop()!;
      restoredImagePath = await resolveImage(fileName);
    }

    const rawVault = raw.vaultType ?? raw.vault_type;
    const normalizedVaultType = VaultType.parse(rawVault).type;
    const amount = Number(raw.amount) || 0;
    const rawConverted = raw.convertedAmount ?? raw.converted_amount;
    const convertedAmount =
      rawConverted !== null && rawConverted !== undefined
        ? Number(rawConverted)
        : amount;
    const txType = raw.type === 'income' ? 'income' : 'expense';
    const txDate = Number(raw.date) || now;
    const createdAt = Number(raw.createdAt ?? raw.created_at) || txDate;
    const updatedAt = Number(raw.updatedAt ?? raw.updated_at) || createdAt;
    const isRecurring = (raw.isRecurring ?? raw.is_recurring) ? 1 : 0;
    const recurringExpenseId = (raw.recurringExpenseId ?? raw.recurring_expense_id) ?? null;
    const subscriptionId = (raw.subscriptionId ?? raw.subscription_id) ?? null;
    const originalAmount =
      (raw.originalAmount ?? raw.original_amount) !== undefined && (raw.originalAmount ?? raw.original_amount) !== null
        ? Number(raw.originalAmount ?? raw.original_amount)
        : null;
    const exchangeRate =
      (raw.exchangeRate ?? raw.exchange_rate) !== undefined && (raw.exchangeRate ?? raw.exchange_rate) !== null
        ? Number(raw.exchangeRate ?? raw.exchange_rate)
        : null;
    const currency = raw.currency || 'USD';

    await executeSql(
      `INSERT INTO transactions
       (id, account_id, type, amount, category_id, description, date, vault_type,
        is_recurring, recurring_expense_id, subscription_id, image_path, currency,
        original_amount, exchange_rate, converted_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         account_id = excluded.account_id,
         type = excluded.type,
         amount = excluded.amount,
         category_id = excluded.category_id,
         description = excluded.description,
         date = excluded.date,
         vault_type = excluded.vault_type,
         is_recurring = excluded.is_recurring,
         recurring_expense_id = excluded.recurring_expense_id,
         subscription_id = excluded.subscription_id,
         image_path = COALESCE(excluded.image_path, transactions.image_path),
         currency = excluded.currency,
         original_amount = excluded.original_amount,
         exchange_rate = excluded.exchange_rate,
         converted_amount = excluded.converted_amount,
         updated_at = excluded.updated_at`,
      [
        tId, currentAccountId, txType, amount, categoryId, raw.description ?? null,
        txDate, normalizedVaultType, isRecurring,
        recurringExpenseId, subscriptionId,
        restoredImagePath,
        currency, originalAmount,
        exchangeRate, convertedAmount,
        createdAt, updatedAt,
      ]
    );
    counts.transactions += 1;

    for (let i = 0; i < newImagePaths.length; i++) {
      const imgId = `${tId}-img-${i}`;
      await executeSql(
        `INSERT OR IGNORE INTO transaction_images (id, transaction_id, image_path, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [imgId, tId, newImagePaths[i], i, Date.now()]
      );
    }
  }

  // Import subscriptions (ON CONFLICT resilient)
  for (const s of subscriptions ?? []) {
    const raw = s as Record<string, any>;
    const sId = raw.id;
    if (!sId) continue;

    const rawCatId = raw.categoryId ?? raw.category_id;
    let categoryId = categoryIdMap.get(rawCatId) ?? rawCatId;
    const catCheck = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId]
    );
    if (catCheck.length === 0) categoryId = defaultCategoryId;

    const rawVault = raw.vaultType ?? raw.vault_type;
    const normalizedVaultType = VaultType.parse(rawVault).type;
    const name = raw.name || 'Subscription';
    const amount = Number(raw.amount) || 0;
    const billingDay = Number(raw.billingDay ?? raw.billing_day) || 1;
    const isActive = (raw.isActive ?? raw.is_active ?? true) ? 1 : 0;
    const lastProcessed = (raw.lastProcessed ?? raw.last_processed) ? Number(raw.lastProcessed ?? raw.last_processed) : null;
    const nextProcessing = Number(raw.nextProcessing ?? raw.next_processing) || now;
    const createdAt = Number(raw.createdAt ?? raw.created_at) || now;
    const updatedAt = Number(raw.updatedAt ?? raw.updated_at) || createdAt;

    await executeSql(
      `INSERT INTO subscriptions
       (id, account_id, name, amount, category_id, billing_day, is_active,
        vault_type, last_processed, next_processing, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         account_id = excluded.account_id,
         name = excluded.name,
         amount = excluded.amount,
         category_id = excluded.category_id,
         billing_day = excluded.billing_day,
         is_active = excluded.is_active,
         vault_type = excluded.vault_type,
         last_processed = excluded.last_processed,
         next_processing = excluded.next_processing,
         updated_at = excluded.updated_at`,
      [
        sId, currentAccountId, name, amount, categoryId, billingDay,
        isActive, normalizedVaultType, lastProcessed,
        nextProcessing, createdAt, updatedAt,
      ]
    );
    counts.subscriptions += 1;
  }

  // Import recurring expenses (ON CONFLICT resilient)
  for (const r of recurringExpenses ?? []) {
    const raw = r as Record<string, any>;
    const rId = raw.id;
    if (!rId) continue;

    const rawCatId = raw.categoryId ?? raw.category_id;
    let categoryId = categoryIdMap.get(rawCatId) ?? rawCatId;
    const catCheck = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId]
    );
    if (catCheck.length === 0) categoryId = defaultCategoryId;

    const rawVault = raw.vaultType ?? raw.vault_type;
    const normalizedVaultType = VaultType.parse(rawVault).type;
    const name = raw.name || 'Recurring Expense';
    const amount = Number(raw.amount) || 0;
    const frequency = raw.frequency || 'monthly';
    const interval = Number(raw.interval) || 1;
    const nextOccurrence = Number(raw.nextOccurrence ?? raw.next_occurrence) || now;
    const isActive = (raw.isActive ?? raw.is_active ?? true) ? 1 : 0;
    const autoDeduct = (raw.autoDeduct ?? raw.auto_deduct ?? true) ? 1 : 0;
    const lastProcessed = (raw.lastProcessed ?? raw.last_processed) ? Number(raw.lastProcessed ?? raw.last_processed) : null;
    const createdAt = Number(raw.createdAt ?? raw.created_at) || now;
    const updatedAt = Number(raw.updatedAt ?? raw.updated_at) || createdAt;

    await executeSql(
      `INSERT INTO recurring_expenses
       (id, account_id, name, amount, category_id, frequency, interval,
        next_occurrence, vault_type, is_active, auto_deduct, last_processed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         account_id = excluded.account_id,
         name = excluded.name,
         amount = excluded.amount,
         category_id = excluded.category_id,
         frequency = excluded.frequency,
         interval = excluded.interval,
         next_occurrence = excluded.next_occurrence,
         vault_type = excluded.vault_type,
         is_active = excluded.is_active,
         auto_deduct = excluded.auto_deduct,
         last_processed = excluded.last_processed,
         updated_at = excluded.updated_at`,
      [
        rId, currentAccountId, name, amount, categoryId, frequency,
        interval, nextOccurrence, normalizedVaultType, isActive,
        autoDeduct, lastProcessed, createdAt, updatedAt,
      ]
    );
    counts.recurringExpenses += 1;
  }

  // Import goals (ON CONFLICT resilient)
  for (const g of goals ?? []) {
    const raw = g as Record<string, any>;
    const gId = raw.id;
    if (!gId) continue;

    const rawTarget = raw.targetAmount ?? raw.target_amount;
    const targetAmount = rawTarget !== null && rawTarget !== undefined ? Number(rawTarget) : null;
    const rawCurrent = raw.currentAmount ?? raw.current_amount;
    const currentAmount = Number(rawCurrent) || 0;
    const fundingSource = VaultType.parse(raw.fundingSource ?? raw.funding_source ?? 'main').type;
    const isCompleted = (raw.isCompleted ?? raw.is_completed) ? 1 : 0;
    const completedAt = (raw.completedAt ?? raw.completed_at) ? Number(raw.completedAt ?? raw.completed_at) : null;
    const createdAt = Number(raw.createdAt ?? raw.created_at) || now;
    const updatedAt = Number(raw.updatedAt ?? raw.updated_at) || createdAt;

    await executeSql(
      `INSERT INTO goals
       (id, account_id, name, target_amount, current_amount, funding_source,
        icon, color, is_completed, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         account_id = excluded.account_id,
         name = excluded.name,
         target_amount = excluded.target_amount,
         current_amount = excluded.current_amount,
         funding_source = excluded.funding_source,
         icon = excluded.icon,
         color = excluded.color,
         is_completed = excluded.is_completed,
         completed_at = excluded.completed_at,
         updated_at = excluded.updated_at`,
      [
        gId, currentAccountId, raw.name || 'Goal', targetAmount,
        currentAmount, fundingSource, raw.icon || 'flag', raw.color || '#007AFF',
        isCompleted, completedAt, createdAt, updatedAt,
      ]
    );
    counts.goals += 1;
  }

  // Import debts (ON CONFLICT resilient)
  for (const d of debts ?? []) {
    const raw = d as Record<string, any>;
    const dId = raw.id;
    if (!dId) continue;

    const rawCatId = raw.categoryId ?? raw.category_id;
    let categoryId = rawCatId ? (categoryIdMap.get(rawCatId) ?? rawCatId) : null;
    if (categoryId) {
      const catCheck = await executeSql<{ id: string }>(
        'SELECT id FROM categories WHERE id = ?',
        [categoryId]
      );
      if (catCheck.length === 0) categoryId = null;
    }

    const type = raw.type || 'lent';
    const personName = raw.personName ?? raw.person_name ?? 'Unknown';
    const amount = Number(raw.amount) || 0;
    const amountPaid = Number(raw.amountPaid ?? raw.amount_paid) || 0;
    const rawDue = raw.dueDate ?? raw.due_date;
    const dueDate = rawDue ? Number(rawDue) : null;
    const status = raw.status || 'pending';
    const description = raw.description ?? null;
    const createdAt = Number(raw.createdAt ?? raw.created_at) || now;
    const updatedAt = Number(raw.updatedAt ?? raw.updated_at) || createdAt;

    await executeSql(
      `INSERT INTO debts
       (id, account_id, type, person_name, amount, amount_paid, due_date,
        status, description, category_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         account_id = excluded.account_id,
         type = excluded.type,
         person_name = excluded.person_name,
         amount = excluded.amount,
         amount_paid = excluded.amount_paid,
         due_date = excluded.due_date,
         status = excluded.status,
         description = excluded.description,
         category_id = excluded.category_id,
         updated_at = excluded.updated_at`,
      [
        dId, currentAccountId, type, personName,
        amount, amountPaid,
        dueDate, status, description,
        categoryId, createdAt, updatedAt,
      ]
    );
    counts.debts += 1;
  }

  // 7. Import budgets if present in payload
  for (const b of budgets ?? []) {
    const raw = b as Record<string, any>;
    const bId = raw.id || uuidv4();
    const rawCatId = raw.categoryId ?? raw.category_id;
    let categoryId = rawCatId ? (categoryIdMap.get(rawCatId) ?? rawCatId) : null;
    if (!categoryId) continue;

    const catCheck = await executeSql<{ id: string }>(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId]
    );
    if (catCheck.length === 0) continue;

    const amount = Number(raw.amount) || 0;
    const period = raw.period || 'monthly';
    const rollover = raw.rollover ? 1 : 0;
    const createdAt = Number(raw.createdAt ?? raw.created_at) || now;
    const updatedAt = Number(raw.updatedAt ?? raw.updated_at) || createdAt;

    await executeSql(
      `INSERT INTO budgets (id, account_id, category_id, amount, period, rollover, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         account_id = excluded.account_id,
         category_id = excluded.category_id,
         amount = excluded.amount,
         period = excluded.period,
         rollover = excluded.rollover,
         updated_at = excluded.updated_at`,
      [bId, currentAccountId, categoryId, amount, period, rollover, createdAt, updatedAt]
    );
    counts.budgets += 1;
  }

  // 8. Restore application and notification settings if present
  const settingsStore = useSettingsStore.getState();
  if (salarySettings && typeof salarySettings === 'object') {
    settingsStore.updateSalarySettings(salarySettings);
  }
  if (notificationSettings && typeof notificationSettings === 'object') {
    settingsStore.updateNotificationSettings(notificationSettings);
  }
  if (appSettings && typeof appSettings === 'object') {
    settingsStore.updateAppSettings(appSettings);
  }
  if (securitySettings && typeof securitySettings === 'object') {
    settingsStore.updateSecuritySettings(securitySettings);
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
  await executeSql('UPDATE budgets SET category_id = ? WHERE account_id = ? AND category_id = ?', [
    newCategoryId,
    accountId,
    oldCategoryId,
  ]);
}
