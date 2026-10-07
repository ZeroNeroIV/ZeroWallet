/**
 * GoogleDriveService — Simplizum Architectural Cloud Vault Integration
 *
 * Direct REST API client for Google Drive v3 integration:
 * - Scoped exclusively to 'drive.file' for zero-knowledge data privacy
 * - Multipart/related binary & base64 archive uploading
 * - Local streaming file downloads via native download manager
 * - Backup manifest indexing and automated retention pruning
 * - Seamless OAuth 2.0 Web callback & direct token authorization
 */

import RNFS from 'react-native-fs';
import { useSettingsStore } from '../../store/settingsStore';
import { useAccountStore } from '../../store/accountStore';
import { createBackupZip, EXPORT_VERSION } from './exportService';
import { importBackupFromFile } from './importService';
import { calculateVaultBalances } from '../../utils/balanceCalculator';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
export const DRIVE_ABOUT_ENDPOINT = 'https://www.googleapis.com/drive/v3/about';
export const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const DEFAULT_REDIRECT_URI = 'wallet://oauth/google';

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export interface GoogleDriveUserInfo {
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  description?: string;
}

export interface BackupExecutionResult {
  fileId: string;
  fileName: string;
  size: number;
  timestamp: number;
}

/**
 * Builds the OAuth 2.0 authorization URL for web consent.
 */
export function buildGoogleAuthUrl(clientId?: string, redirectUri: string = DEFAULT_REDIRECT_URI): string {
  const activeClientId = clientId || useSettingsStore.getState().googleDriveSettings.clientId || '';
  if (!activeClientId) {
    throw new Error('Google Cloud OAuth Client ID is required to initiate authorization.');
  }

  const params = [
    `client_id=${encodeURIComponent(activeClientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    'response_type=token',
    `scope=${encodeURIComponent(DRIVE_SCOPES)}`,
    'prompt=consent',
    'include_granted_scopes=true',
  ].join('&');

  return `${GOOGLE_AUTH_ENDPOINT}?${params}`;
}

/**
 * Parses deep link callback URLs for OAuth token parameters.
 */
export function parseOAuthCallbackUrl(url: string): {
  accessToken?: string;
  expiresIn?: number;
  tokenType?: string;
  error?: string;
} {
  const result: { accessToken?: string; expiresIn?: number; tokenType?: string; error?: string } = {};

  // Check both query (?...) and fragment (#...)
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const paramsString = fragment || query;

  if (!paramsString) return result;

  const pairs = paramsString.split('&');
  for (const pair of pairs) {
    const [key, val] = pair.split('=');
    if (!key) continue;
    const decodedVal = decodeURIComponent(val || '');
    if (key === 'access_token') result.accessToken = decodedVal;
    if (key === 'expires_in') result.expiresIn = Number(decodedVal);
    if (key === 'token_type') result.tokenType = decodedVal;
    if (key === 'error') result.error = decodedVal;
  }

  return result;
}

/**
 * Fetches the user profile information associated with an access token.
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleDriveUserInfo> {
  const response = await fetch(USERINFO_ENDPOINT, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      response.status === 401
        ? 'Google Drive authorization token has expired or is invalid.'
        : `Failed to fetch Google profile (HTTP ${response.status}): ${errText}`
    );
  }

  const data = await response.json();
  return {
    email: data.email || 'Google User',
    name: data.name || data.email || 'ZeroWallet User',
    picture: data.picture,
  };
}

/**
 * Verifies an access token and updates the application store.
 */
export async function verifyTokenAndConnect(
  accessToken: string,
  refreshToken?: string | null,
  expiresInSeconds?: number,
  customClientId?: string
): Promise<GoogleDriveUserInfo> {
  const cleanToken = accessToken.trim();
  if (!cleanToken) {
    throw new Error('Please provide a valid Google access token.');
  }

  const userInfo = await fetchGoogleUserInfo(cleanToken);

  const expiresAt = expiresInSeconds && expiresInSeconds > 0
    ? Date.now() + expiresInSeconds * 1000
    : null;

  useSettingsStore.getState().updateGoogleDriveSettings({
    isConnected: true,
    accountEmail: userInfo.email,
    accountName: userInfo.name,
    accountPicture: userInfo.picture || null,
    accessToken: cleanToken,
    refreshToken: refreshToken ?? null,
    tokenExpiresAt: expiresAt,
    clientId: customClientId !== undefined ? customClientId : useSettingsStore.getState().googleDriveSettings.clientId,
    lastBackupError: null,
  });

  return userInfo;
}

/**
 * Lists all ZeroWallet backup archives stored on Google Drive.
 */
export async function listGoogleDriveBackups(accessToken: string): Promise<GoogleDriveFile[]> {
  const query = "trashed = false and (name contains 'wallet-backup' or name contains 'ZeroWallet_Backup')";
  const fields = 'files(id, name, size, createdTime, modifiedTime, description)';
  const orderBy = 'createdTime desc';

  const url = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(
    fields
  )}&orderBy=${encodeURIComponent(orderBy)}&pageSize=50`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      useSettingsStore.getState().updateGoogleDriveSettings({
        lastBackupStatus: 'failed',
        lastBackupError: 'Google Drive authorization expired',
      });
      throw new Error('Google authorization expired. Please re-authenticate your Google Account.');
    }
    const errText = await response.text();
    throw new Error(`Failed to query Google Drive (HTTP ${response.status}): ${errText}`);
  }

  const data = await response.json();
  const files: GoogleDriveFile[] = (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    size: Number(f.size) || 0,
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
    description: f.description,
  }));

  return files;
}

/**
 * Uploads a local ZIP backup file to Google Drive using multipart upload.
 */
export async function uploadBackupToGoogleDrive(
  accessToken: string,
  zipPath: string,
  fileName: string
): Promise<GoogleDriveFile> {
  if (!(await RNFS.exists(zipPath))) {
    throw new Error(`Backup file not found at path: ${zipPath}`);
  }

  const base64Data = await RNFS.readFile(zipPath, 'base64');
  const boundary = `-------ZeroWalletBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: 'application/zip',
    description: 'ZeroWallet Automatic Cloud Vault Backup Archive',
    appProperties: {
      app: 'ZeroWallet',
      version: EXPORT_VERSION,
      uploadedAt: new Date().toISOString(),
    },
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/zip\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Data +
    closeDelimiter;

  const response = await fetch(DRIVE_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      Accept: 'application/json',
    },
    body: multipartRequestBody,
  });

  if (!response.ok) {
    if (response.status === 401) {
      useSettingsStore.getState().updateGoogleDriveSettings({
        lastBackupStatus: 'failed',
        lastBackupError: 'Google Drive authorization expired',
      });
      throw new Error('Google authorization expired. Please re-authenticate your Google Account.');
    }
    const errText = await response.text();
    throw new Error(`Google Drive upload rejected (HTTP ${response.status}): ${errText}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    name: result.name || fileName,
    size: Number(result.size) || 0,
    createdTime: result.createdTime || new Date().toISOString(),
    modifiedTime: result.modifiedTime || new Date().toISOString(),
    description: result.description,
  };
}

/**
 * Deletes a backup file from Google Drive by its file ID.
 */
export async function deleteGoogleDriveBackup(accessToken: string, fileId: string): Promise<void> {
  const url = `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errText = await response.text();
    throw new Error(`Failed to delete file from Google Drive (HTTP ${response.status}): ${errText}`);
  }
}

/**
 * Prunes older backups on Google Drive to enforce retention limits.
 */
export async function pruneOldDriveBackups(accessToken: string, keepCount: number = 5): Promise<number> {
  if (keepCount <= 0) return 0;

  try {
    const backups = await listGoogleDriveBackups(accessToken);
    if (backups.length <= keepCount) return 0;

    // Files are sorted createdTime desc, so older files are at the end
    const toDelete = backups.slice(keepCount);
    let deleted = 0;

    for (const item of toDelete) {
      try {
        await deleteGoogleDriveBackup(accessToken, item.id);
        deleted++;
      } catch (err) {
        console.warn(`[GoogleDriveService] Failed to prune backup ${item.id}:`, err);
      }
    }

    console.log(`[GoogleDriveService] Pruned ${deleted} historic backup(s).`);
    return deleted;
  } catch (error) {
    console.warn('[GoogleDriveService] Error during backup retention pruning:', error);
    return 0;
  }
}

/**
 * Downloads a backup archive from Google Drive to local caches directory.
 */
export async function downloadGoogleDriveBackup(
  accessToken: string,
  fileId: string,
  fileName: string
): Promise<string> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destPath = `${RNFS.CachesDirectoryPath}/gdrive-restore-${Date.now()}-${safeName}`;

  if (await RNFS.exists(destPath)) {
    await RNFS.unlink(destPath);
  }

  const downloadResult = await RNFS.downloadFile({
    fromUrl: `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?alt=media`,
    toFile: destPath,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).promise;

  if (downloadResult.statusCode !== 200) {
    try { await RNFS.unlink(destPath); } catch {}
    throw new Error(`Google Drive download failed with status ${downloadResult.statusCode}`);
  }

  return destPath;
}

/**
 * Orchestrates an end-to-end Google Drive backup:
 *  1. Builds zip archive using createBackupZip
 *  2. Uploads archive to Google Drive
 *  3. Applies retention pruning
 *  4. Cleans up local temp cache
 *  5. Updates store timestamps
 */
export async function performGoogleDriveBackup(
  accountId: string,
  userId: string
): Promise<BackupExecutionResult> {
  const settings = useSettingsStore.getState().googleDriveSettings;
  const token = settings.accessToken;

  if (!token) {
    throw new Error('Google Drive is not linked. Please connect your Google account in Settings.');
  }

  // 1. Create backup archive on disk
  const { zipPath, fileName, size } = await createBackupZip(accountId, userId);

  try {
    // 2. Upload to Google Drive
    const uploaded = await uploadBackupToGoogleDrive(token, zipPath, fileName);

    // 3. Prune old backups according to retention settings
    if (settings.keepBackupCount > 0) {
      await pruneOldDriveBackups(token, settings.keepBackupCount);
    }

    const now = Date.now();
    useSettingsStore.getState().updateGoogleDriveSettings({
      lastBackupTime: now,
      lastBackupStatus: 'success',
      lastBackupError: null,
    });

    return {
      fileId: uploaded.id,
      fileName,
      size,
      timestamp: now,
    };
  } catch (error: any) {
    useSettingsStore.getState().updateGoogleDriveSettings({
      lastBackupStatus: 'failed',
      lastBackupError: error?.message || 'Backup failed',
    });
    throw error;
  } finally {
    // 4. Always clean up temporary zip on disk
    try {
      if (await RNFS.exists(zipPath)) {
        await RNFS.unlink(zipPath);
      }
    } catch {}
  }
}

/**
 * Downloads a backup from Google Drive and restores records into the current account.
 */
export async function restoreBackupFromGoogleDrive(
  fileId: string,
  fileName: string,
  currentAccountId: string,
  currentUserId: string
): Promise<{ imported: Record<string, number> }> {
  const token = useSettingsStore.getState().googleDriveSettings.accessToken;
  if (!token) {
    throw new Error('Google Drive authorization required.');
  }

  const downloadedPath = await downloadGoogleDriveBackup(token, fileId, fileName);

  try {
    // Import records from the downloaded archive
    const result = await importBackupFromFile(downloadedPath, currentAccountId, currentUserId);

    // Refresh store balances
    const txRepo = new TransactionRepository();
    const txs = await txRepo.findByAccount(currentAccountId);
    useAccountStore.getState().updateBalance(currentAccountId, calculateVaultBalances(txs));

    return result;
  } finally {
    // Clean up downloaded zip
    try {
      if (await RNFS.exists(downloadedPath)) {
        await RNFS.unlink(downloadedPath);
      }
    } catch {}
  }
}
