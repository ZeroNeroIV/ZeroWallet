import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import JSZip from 'jszip';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { SubscriptionRepository } from '../../database/repositories/SubscriptionRepository';
import { RecurringExpenseRepository } from '../../database/repositories/RecurringExpenseRepository';
import { GoalRepository } from '../../database/repositories/GoalRepository';
import { DebtRepository } from '../../database/repositories/DebtRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { useSettingsStore } from '../../store/settingsStore';

export const EXPORT_VERSION = '1.2';

const IMAGES_DIR = `${RNFS.DocumentDirectoryPath}/transaction-images`;

export interface BackupZipResult {
  zipPath: string;
  fileName: string;
  size: number;
}

/**
 * Creates a self-contained ZIP archive containing all application records,
 * transaction receipt photos, configuration metadata, and a manifest README.
 */
export async function createBackupZip(accountId: string, userId: string): Promise<BackupZipResult> {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `wallet-backup-${dateStr}-${Date.now()}.zip`;
  const zipPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

  // ── 1. Fetch all data ────────────────────────────────────────────────────
  const {
    salarySettings,
    notificationSettings,
    appSettings,
    securitySettings,
    googleDriveSettings,
  } = useSettingsStore.getState();

  const [account, categories, transactions, subscriptions, recurringExpenses, goals, debts, wallets, budgets] =
    await Promise.all([
      new AccountRepository().findById(accountId),
      new CategoryRepository().findByUser(userId),
      new TransactionRepository().findByAccount(accountId),
      new SubscriptionRepository().findByAccount(accountId),
      new RecurringExpenseRepository().findByAccount(accountId),
      new GoalRepository().findByAccount(accountId),
      new DebtRepository().findByAccount(accountId),
      new WalletRepository().findByAccount(accountId),
      new (await import('../../database/repositories/BudgetRepository')).BudgetRepository().findByAccount(accountId),
    ]);

  // Also load per-transaction images from transaction_images table
  const txRepo = new TransactionRepository();
  const transactionsWithImages = await Promise.all(
    transactions.map(async t => ({
      ...t,
      images: await txRepo.getImages(t.id),
    }))
  );

  // ── 2. Build ZIP in memory ───────────────────────────────────────────────
  const zip = new JSZip();

  // Strip sensitive OAuth tokens from exported snapshot
  const sanitizedDriveSettings = {
    ...googleDriveSettings,
    accessToken: null,
    refreshToken: null,
  };

  const exportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      account,
      wallets,
      categories,
      transactions: transactionsWithImages,
      subscriptions,
      recurringExpenses,
      goals,
      debts,
      budgets,
      salarySettings,
      notificationSettings,
      appSettings,
      securitySettings,
      googleDriveSettings: sanitizedDriveSettings,
    },
  };

  zip.file('data.json', JSON.stringify(exportData, null, 2));

  // ── 3. Add transaction images ────────────────────────────────────────────
  const allImagePaths = new Set<string>();
  for (const t of transactionsWithImages) {
    if (t.imagePath) allImagePaths.add(t.imagePath);
    for (const img of t.images ?? []) allImagePaths.add(img);
  }

  // Also include entire originals folder
  const originalsDir = `${IMAGES_DIR}/originals`;
  if (await RNFS.exists(originalsDir)) {
    const files = await RNFS.readDir(originalsDir);
    for (const f of files) allImagePaths.add(f.path);
  }

  let copiedCount = 0;
  for (const imgPath of allImagePaths) {
    const cleanPath = imgPath.replace('file://', '');
    if (await RNFS.exists(cleanPath)) {
      const imgFileName = cleanPath.split('/').pop()!;
      const base64 = await RNFS.readFile(cleanPath, 'base64');
      zip.file(`images/${imgFileName}`, base64, { base64: true });
      copiedCount++;
    }
  }

  // ── 4. Add README ────────────────────────────────────────────────────────
  const readme = [
    'Wallet App Backup',
    '=================',
    `Exported: ${new Date().toLocaleString()}`,
    `Version: ${EXPORT_VERSION}`,
    '',
    'Contents:',
    '  data.json        — All account data (transactions, categories, goals, debts, subscriptions)',
    `  images/          — ${copiedCount} transaction receipt image(s)`,
    '',
    'To restore: use the Import Data option in Settings or Cloud Restore.',
  ].join('\n');

  zip.file('README.txt', readme);

  // ── 5. Write ZIP to disk ─────────────────────────────────────────────────
  const zipBase64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  if (await RNFS.exists(zipPath)) await RNFS.unlink(zipPath);
  await RNFS.writeFile(zipPath, zipBase64, 'base64');

  const stat = await RNFS.stat(zipPath);

  return {
    zipPath,
    fileName,
    size: Number(stat.size) || 0,
  };
}

export async function exportAllData(accountId: string, userId: string): Promise<void> {
  const { zipPath, fileName } = await createBackupZip(accountId, userId);

  try {
    // ── 6. Share the zip ─────────────────────────────────────────────────────
    await Share.open({
      url: `file://${zipPath}`,
      type: 'application/zip',
      filename: fileName,
      title: 'Export Wallet Backup',
      failOnCancel: false,
    });
  } finally {
    // ── 7. Clean up ──────────────────────────────────────────────────────────
    try { await RNFS.unlink(zipPath); } catch {}
  }
}

export async function exportTransactionsCSV(accountId: string, userId: string): Promise<void> {
  const dateStr = new Date().toISOString().split('T')[0];
  const csvPath = `${RNFS.CachesDirectoryPath}/transactions-${dateStr}.csv`;

  const [transactions, categories, wallets] = await Promise.all([
    new TransactionRepository().findByAccount(accountId),
    new CategoryRepository().findByUser(userId),
    new WalletRepository().findByAccount(accountId),
  ]);

  const categoryMap = new Map<string, string>();
  categories.forEach(c => categoryMap.set(c.id, c.name));

  const walletMap = new Map<string, string>();
  wallets.forEach(w => walletMap.set(w.id, w.name));

  const headers = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Wallet', 'Vault', 'Description'];
  const rows = transactions.map(t => {
    const date = new Date(t.date).toISOString().split('T')[0];
    const category = categoryMap.get(t.categoryId) || 'Uncategorized';
    const wallet = walletMap.get(t.walletId || '') || t.vaultType || 'main';
    const desc = (t.description || '').replace(/"/g, '""');
    return `"${date}","${t.type}","${t.amount}","${t.currency}","${category}","${wallet}","${t.vaultType}","${desc}"`;
  });

  const csvContent = [headers.join(','), ...rows].join('\n');

  if (await RNFS.exists(csvPath)) await RNFS.unlink(csvPath);
  await RNFS.writeFile(csvPath, csvContent, 'utf8');

  await Share.open({
    url: `file://${csvPath}`,
    type: 'text/csv',
    filename: `transactions-${dateStr}.csv`,
    title: 'Export Transactions CSV',
    failOnCancel: false,
  });

  try { await RNFS.unlink(csvPath); } catch {}
}

