/**
 * GoogleDriveBackupScreen — Simplizum Architectural Edition
 *
 * Direct, zero-knowledge Google Drive backup & restore management:
 * - Scoped OAuth 2.0 / direct token authorization
 * - Automated background backup scheduling (Daily, Weekly, Monthly)
 * - Time-of-day execution & retention pruning limits
 * - Instant on-demand cloud snapshots with receipt archiving
 * - Remote cloud backup catalog with one-tap selective restores
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { spacing } from '../../theme/spacing';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic, heavyHaptic, errorHaptic } from '../../services/haptics/hapticFeedback';
import {
  buildGoogleAuthUrl,
  parseOAuthCallbackUrl,
  verifyTokenAndConnect,
  listGoogleDriveBackups,
  performGoogleDriveBackup,
  restoreBackupFromGoogleDrive,
  deleteGoogleDriveBackup,
  fetchGoogleUserInfo,
  GoogleDriveFile,
} from '../../services/dataTransfer/googleDriveService';
import { GoogleDriveExplainerModal } from './GoogleDriveExplainerModal';
import type { BackupFrequency } from '../../types/models';

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(isoOrTimestamp: string | number | null): string {
  if (!isoOrTimestamp) return 'Never';
  const d = new Date(isoOrTimestamp);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isValidTime(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export default function GoogleDriveBackupScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const { googleDriveSettings, updateGoogleDriveSettings, disconnectGoogleDrive } = useSettingsStore();
  const { currentAccountId, currentUser } = useAuthStore();

  // State
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isLoadingBackups, setIsLoadingBackups] = useState<boolean>(false);
  const [driveBackups, setDriveBackups] = useState<GoogleDriveFile[]>([]);
  const [showExplainer, setShowExplainer] = useState<boolean>(false);
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);

  // Manual token modal state
  const [tokenInput, setTokenInput] = useState<string>('');
  const [clientIdInput, setClientIdInput] = useState<string>(googleDriveSettings.clientId || '');
  const [isVerifyingToken, setIsVerifyingToken] = useState<boolean>(false);

  // Scheduled time editing state
  const [backupTimeInput, setBackupTimeInput] = useState<string>(googleDriveSettings.backupTime || '02:00');

  // Load backups when connected
  const loadDriveBackups = useCallback(async () => {
    if (!googleDriveSettings.isConnected || !googleDriveSettings.accessToken) {
      setDriveBackups([]);
      return;
    }

    setIsLoadingBackups(true);
    try {
      const files = await listGoogleDriveBackups(googleDriveSettings.accessToken);
      setDriveBackups(files);
    } catch (err: any) {
      console.warn('[GoogleDriveBackupScreen] Failed to load backups:', err?.message);
    } finally {
      setIsLoadingBackups(false);
    }
  }, [googleDriveSettings.isConnected, googleDriveSettings.accessToken]);

  useEffect(() => {
    loadDriveBackups();
  }, [loadDriveBackups]);

  // Deep link listener for OAuth redirect (wallet://oauth/google#access_token=...)
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      if (!event.url || !event.url.includes('oauth/google')) return;

      const parsed = parseOAuthCallbackUrl(event.url);
      if (parsed.error) {
        errorHaptic();
        Alert.alert('Authorization Failed', `Google rejected authorization: ${parsed.error}`);
        return;
      }

      if (parsed.accessToken) {
        try {
          mediumHaptic();
          await verifyTokenAndConnect(parsed.accessToken, null, parsed.expiresIn, clientIdInput || undefined);
          heavyHaptic();
          Alert.alert('LINKED TO GOOGLE DRIVE', 'Your Google account was successfully connected.');
          loadDriveBackups();
        } catch (err: any) {
          errorHaptic();
          Alert.alert('Connection Error', err?.message || 'Could not verify Google credentials.');
        }
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => {
      sub.remove();
    };
  }, [clientIdInput, loadDriveBackups]);

  // Handle OAuth sign in button press
  const handleConnectWithOAuth = async () => {
    lightHaptic();
    try {
      const authUrl = buildGoogleAuthUrl(googleDriveSettings.clientId || undefined);
      const canOpen = await Linking.canOpenURL(authUrl);
      if (canOpen) {
        await Linking.openURL(authUrl);
      } else {
        setShowTokenModal(true);
      }
    } catch (err: any) {
      // If no client ID configured yet, open token/client modal
      setShowTokenModal(true);
    }
  };

  // Handle verifying and connecting token manually
  const handleVerifyManualToken = async () => {
    if (!tokenInput.trim()) {
      Alert.alert('Token Required', 'Please enter your Google OAuth access token.');
      return;
    }

    setIsVerifyingToken(true);
    try {
      const user = await verifyTokenAndConnect(tokenInput.trim(), null, 3600, clientIdInput.trim() || undefined);
      heavyHaptic();
      setShowTokenModal(false);
      setTokenInput('');
      Alert.alert('LINKED TO GOOGLE DRIVE', `Connected as ${user.email}.`);
      loadDriveBackups();
    } catch (err: any) {
      errorHaptic();
      Alert.alert('Verification Failed', err?.message || 'Token is invalid or does not have Google Drive permissions.');
    } finally {
      setIsVerifyingToken(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = () => {
    mediumHaptic();
    Alert.alert(
      'DISCONNECT GOOGLE DRIVE',
      'Are you sure you want to unlink your Google Drive account? Automated cloud backups will be suspended.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => lightHaptic() },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            heavyHaptic();
            disconnectGoogleDrive();
            setDriveBackups([]);
          },
        },
      ]
    );
  };

  // Test Connection
  const handleTestConnection = async () => {
    if (!googleDriveSettings.accessToken) return;
    lightHaptic();
    try {
      const start = Date.now();
      const user = await fetchGoogleUserInfo(googleDriveSettings.accessToken);
      const latency = Date.now() - start;
      heavyHaptic();
      Alert.alert('CONNECTION ACTIVE', `Linked: ${user.email}\nLatency: ${latency}ms\nScope: drive.file`);
    } catch (err: any) {
      errorHaptic();
      Alert.alert('Connection Stale', err?.message || 'Authorization has expired. Please re-authenticate.');
    }
  };

  // Manual Backup Now
  const handleBackupNow = async () => {
    if (!currentAccountId || !currentUser) {
      Alert.alert('Account Required', 'Please select an active wallet account.');
      return;
    }

    if (!googleDriveSettings.isConnected || !googleDriveSettings.accessToken) {
      Alert.alert('Connect Required', 'Please connect your Google Drive account first.');
      return;
    }

    lightHaptic();
    setIsBackingUp(true);

    try {
      const result = await performGoogleDriveBackup(currentAccountId, currentUser.id);
      heavyHaptic();
      Alert.alert(
        'BACKUP COMPLETE',
        `Successfully encrypted and uploaded ${result.fileName} (${formatFileSize(result.size)}) to Google Drive.`
      );
      loadDriveBackups();
    } catch (err: any) {
      errorHaptic();
      Alert.alert('Backup Failed', err?.message || 'Could not complete cloud backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restore from Cloud Backup
  const handleRestore = (item: GoogleDriveFile) => {
    lightHaptic();
    Alert.alert(
      'RESTORE CLOUD ARCHIVE',
      `Restore from "${item.name}" (${formatFileSize(item.size)}) created on ${formatDate(item.createdTime)}?\n\nExisting local records will be preserved and merged safely.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => lightHaptic() },
        {
          text: 'Restore Now',
          onPress: async () => {
            if (!currentAccountId || !currentUser) return;
            mediumHaptic();
            setIsRestoringId(item.id);

            try {
              const res = await restoreBackupFromGoogleDrive(
                item.id,
                item.name,
                currentAccountId,
                currentUser.id
              );
              heavyHaptic();

              const summary: string[] = [];
              if (res.imported.wallets) summary.push(`${res.imported.wallets} wallets`);
              if (res.imported.transactions) summary.push(`${res.imported.transactions} transactions`);
              if (res.imported.categories) summary.push(`${res.imported.categories} categories`);
              if (res.imported.goals) summary.push(`${res.imported.goals} goals`);
              if (res.imported.debts) summary.push(`${res.imported.debts} debts`);

              Alert.alert(
                'RESTORE SUCCESS',
                summary.length > 0
                  ? `Successfully synchronized: ${summary.join(', ')}.`
                  : 'Ledger up to date. All records synchronized.'
              );
            } catch (err: any) {
              errorHaptic();
              Alert.alert('Restore Failed', err?.message || 'Could not restore cloud archive.');
            } finally {
              setIsRestoringId(null);
            }
          },
        },
      ]
    );
  };

  // Delete Backup from Drive
  const handleDeleteBackup = (item: GoogleDriveFile) => {
    lightHaptic();
    Alert.alert(
      'DELETE CLOUD ARCHIVE',
      `Permanently delete "${item.name}" from your Google Drive? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => lightHaptic() },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!googleDriveSettings.accessToken) return;
            mediumHaptic();
            setIsDeletingId(item.id);

            try {
              await deleteGoogleDriveBackup(googleDriveSettings.accessToken, item.id);
              heavyHaptic();
              setDriveBackups((prev) => prev.filter((b) => b.id !== item.id));
            } catch (err: any) {
              errorHaptic();
              Alert.alert('Delete Failed', err?.message || 'Could not delete backup from Drive.');
            } finally {
              setIsDeletingId(null);
            }
          },
        },
      ]
    );
  };

  // Save Scheduled Time
  const handleSaveBackupTime = () => {
    if (!isValidTime(backupTimeInput)) {
      Alert.alert('Invalid Format', 'Please enter a valid 24-hour time in HH:MM format (e.g. 02:00 for 2:00 AM).');
      return;
    }
    lightHaptic();
    updateGoogleDriveSettings({ backupTime: backupTimeInput.trim() });
    Alert.alert('SCHEDULE UPDATED', `Automatic cloud backups scheduled for ${backupTimeInput.trim()}.`);
  };

  const handleFrequencyChange = (freq: BackupFrequency) => {
    lightHaptic();
    updateGoogleDriveSettings({ frequency: freq });
  };

  const handleRetentionChange = (count: number) => {
    lightHaptic();
    updateGoogleDriveSettings({ keepBackupCount: count });
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              lightHaptic();
              navigation.goBack();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={themeColors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerSuper}>ZERO WALLET · CLOUD PORTABILITY</Text>
            <Text style={styles.headerTitle}>GOOGLE DRIVE BACKUP</Text>
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            googleDriveSettings.isConnected ? styles.statusPillActive : styles.statusPillInactive,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              googleDriveSettings.isConnected ? styles.statusPillTextActive : styles.statusPillTextInactive,
            ]}
          >
            {googleDriveSettings.isConnected ? 'CONNECTED' : 'UNLINKED'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* GROUP 1: GOOGLE ACCOUNT LINKAGE */}
        <View style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>GOOGLE ACCOUNT LINKAGE</Text>
          </View>

          {!googleDriveSettings.isConnected ? (
            <View style={styles.cardInner}>
              <Text style={styles.helperText}>
                Link your personal Google Drive to enable private, automated off-device backups. ZeroWallet communicates directly with Google's servers using the strict <Text style={styles.boldText}>drive.file</Text> scope.
              </Text>

              <TouchableOpacity style={styles.primaryButton} onPress={handleConnectWithOAuth}>
                <MaterialCommunityIcons name="google" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>CONNECT GOOGLE DRIVE</Text>
              </TouchableOpacity>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    lightHaptic();
                    setShowTokenModal(true);
                  }}
                >
                  <MaterialCommunityIcons name="key-outline" size={16} color={themeColors.text} style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryButtonText}>Custom Token / Client</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    lightHaptic();
                    setShowExplainer(true);
                  }}
                >
                  <MaterialCommunityIcons name="help-circle-outline" size={16} color={themeColors.text} style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryButtonText}>Privacy & Guide</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.cardInner}>
              <View style={styles.accountProfileRow}>
                <View style={styles.avatarPill}>
                  <Text style={styles.avatarText}>
                    {(googleDriveSettings.accountName || googleDriveSettings.accountEmail || 'G')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountNameText}>
                    {googleDriveSettings.accountName || 'Google Account'}
                  </Text>
                  <Text style={styles.accountEmailText}>
                    {googleDriveSettings.accountEmail || 'Authorized'}
                  </Text>
                  <View style={styles.scopeBadge}>
                    <MaterialCommunityIcons name="shield-check" size={12} color="#06D6A0" style={{ marginRight: 4 }} />
                    <Text style={styles.scopeBadgeText}>drive.file scope active</Text>
                  </View>
                </View>
              </View>

              <View style={styles.connectedActionsRow}>
                <TouchableOpacity style={styles.actionPillButton} onPress={handleTestConnection}>
                  <MaterialCommunityIcons name="wifi-check" size={16} color={themeColors.text} style={{ marginRight: 4 }} />
                  <Text style={styles.actionPillButtonText}>Ping Auth</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionPillButton}
                  onPress={() => {
                    lightHaptic();
                    setShowExplainer(true);
                  }}
                >
                  <MaterialCommunityIcons name="shield-outline" size={16} color={themeColors.text} style={{ marginRight: 4 }} />
                  <Text style={styles.actionPillButtonText}>Privacy Info</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionPillButton, styles.disconnectPill]} onPress={handleDisconnect}>
                  <MaterialCommunityIcons name="link-off" size={16} color="#EF476F" style={{ marginRight: 4 }} />
                  <Text style={[styles.actionPillButtonText, { color: '#EF476F' }]}>Unlink</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* GROUP 2: SCHEDULED AUTOMATION */}
        <View style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>SCHEDULED AUTOMATION</Text>
          </View>

          {/* Master Toggle */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Automated Cloud Backups</Text>
              <Text style={styles.rowDesc}>Sync ledger snapshot to Google Drive in the background</Text>
            </View>
            <Switch
              value={googleDriveSettings.isEnabled}
              onValueChange={(val) => {
                lightHaptic();
                if (val && !googleDriveSettings.isConnected) {
                  Alert.alert('Google Account Required', 'Please connect your Google Drive account first before enabling scheduled backups.');
                  return;
                }
                updateGoogleDriveSettings({ isEnabled: val });
              }}
              trackColor={{ false: themeColors.hairline, true: '#06D6A0' }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
            />
          </View>

          {googleDriveSettings.isEnabled && (
            <>
              <View style={styles.divider} />

              {/* Schedule Frequency */}
              <View style={styles.segmentedCard}>
                <Text style={styles.segmentLabel}>BACKUP CADENCE</Text>
                <View style={styles.pillsRow}>
                  {(['daily', 'weekly', 'monthly', 'manual'] as BackupFrequency[]).map((freq) => {
                    const isSelected = googleDriveSettings.frequency === freq;
                    return (
                      <TouchableOpacity
                        key={freq}
                        style={[styles.frequencyPill, isSelected && styles.frequencyPillActive]}
                        onPress={() => handleFrequencyChange(freq)}
                      >
                        <Text style={[styles.frequencyPillText, isSelected && styles.frequencyPillTextActive]}>
                          {freq.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.divider} />

              {/* Backup Time */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Preferred Time of Day</Text>
                  <Text style={styles.rowDesc}>24-hour HH:MM format (e.g. 02:00 for 2 AM)</Text>
                </View>
                <View style={styles.timeInputRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={backupTimeInput}
                    onChangeText={setBackupTimeInput}
                    placeholder="02:00"
                    placeholderTextColor={themeColors.textSecondary}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                  />
                  <TouchableOpacity style={styles.saveTimeButton} onPress={handleSaveBackupTime}>
                    <Text style={styles.saveTimeButtonText}>SET</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Retention Policy */}
              <View style={styles.segmentedCard}>
                <Text style={styles.segmentLabel}>HISTORIC RETENTION LIMIT</Text>
                <View style={styles.pillsRow}>
                  {[3, 5, 10].map((count) => {
                    const isSelected = googleDriveSettings.keepBackupCount === count;
                    return (
                      <TouchableOpacity
                        key={count}
                        style={[styles.frequencyPill, isSelected && styles.frequencyPillActive]}
                        onPress={() => handleRetentionChange(count)}
                      >
                        <Text style={[styles.frequencyPillText, isSelected && styles.frequencyPillTextActive]}>
                          {count} BACKUPS
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.retentionDesc}>
                  Older archives beyond {googleDriveSettings.keepBackupCount} copies are pruned to prevent Google Drive storage clutter.
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Notification on Backup */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Completion Notifications</Text>
                  <Text style={styles.rowDesc}>Receive a local alert when background backups finish</Text>
                </View>
                <Switch
                  value={googleDriveSettings.notifyOnBackup}
                  onValueChange={(val) => {
                    lightHaptic();
                    updateGoogleDriveSettings({ notifyOnBackup: val });
                  }}
                  trackColor={{ false: themeColors.hairline, true: themeColors.text }}
                  thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
                />
              </View>
            </>
          )}
        </View>

        {/* GROUP 3: MANUAL BACKUP NOW */}
        <View style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>ON-DEMAND CLOUD SNAPSHOT</Text>
          </View>

          <View style={styles.cardInner}>
            <TouchableOpacity
              style={[styles.primaryButton, isBackingUp && { opacity: 0.7 }]}
              onPress={handleBackupNow}
              disabled={isBackingUp}
            >
              {isBackingUp ? (
                <>
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>ENCRYPTING & UPLOADING...</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>BACK UP NOW TO GOOGLE DRIVE</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.statusRow}>
              <View style={styles.statusCol}>
                <Text style={styles.statusLabel}>LAST SUCCESSFUL BACKUP</Text>
                <Text style={styles.statusValue}>{formatDate(googleDriveSettings.lastBackupTime)}</Text>
              </View>

              <View style={styles.statusBadgeContainer}>
                {googleDriveSettings.lastBackupStatus === 'success' && (
                  <View style={[styles.badge, styles.badgeActive]}>
                    <Text style={styles.badgeActiveText}>HEALTHY</Text>
                  </View>
                )}
                {googleDriveSettings.lastBackupStatus === 'failed' && (
                  <View style={[styles.badge, styles.badgeDanger]}>
                    <Text style={styles.badgeDangerText}>FAILED</Text>
                  </View>
                )}
                {googleDriveSettings.lastBackupStatus === 'idle' && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>READY</Text>
                  </View>
                )}
              </View>
            </View>

            {googleDriveSettings.lastBackupError && (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#EF476F" style={{ marginRight: 6 }} />
                <Text style={styles.errorBannerText}>{googleDriveSettings.lastBackupError}</Text>
              </View>
            )}
          </View>
        </View>

        {/* GROUP 4: STORED CLOUD ARCHIVES */}
        <View style={styles.groupCard}>
          <View style={[styles.groupHeader, { justifyContent: 'space-between' }]}>
            <Text style={styles.groupTitle}>STORED CLOUD ARCHIVES</Text>
            <TouchableOpacity
              onPress={() => {
                lightHaptic();
                loadDriveBackups();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="refresh" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isLoadingBackups ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={themeColors.text} />
              <Text style={styles.loadingText}>Querying Google Drive catalog...</Text>
            </View>
          ) : driveBackups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cloud-outline" size={32} color={themeColors.textSecondary} />
              <Text style={styles.emptyText}>
                {googleDriveSettings.isConnected
                  ? 'No ZeroWallet backups found on Google Drive yet.'
                  : 'Connect your Google Drive account above to view and restore cloud backups.'}
              </Text>
            </View>
          ) : (
            driveBackups.map((item, index) => {
              const isRestoring = isRestoringId === item.id;
              const isDeleting = isDeletingId === item.id;

              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.backupItemRow}>
                    <View style={styles.backupItemLeft}>
                      <Text style={styles.backupItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.backupItemMeta}>
                        {formatDate(item.createdTime)} · {formatFileSize(item.size)}
                      </Text>
                    </View>

                    <View style={styles.backupItemActions}>
                      <TouchableOpacity
                        style={styles.restoreBtn}
                        onPress={() => handleRestore(item)}
                        disabled={isRestoring || isDeleting}
                      >
                        {isRestoring ? (
                          <ActivityIndicator size="small" color={themeColors.text} />
                        ) : (
                          <Text style={styles.restoreBtnText}>RESTORE</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteIconBtn}
                        onPress={() => handleDeleteBackup(item)}
                        disabled={isRestoring || isDeleting}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#EF476F" />
                        ) : (
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF476F" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </React.Fragment>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Educational Explainer Modal */}
      <GoogleDriveExplainerModal visible={showExplainer} onClose={() => setShowExplainer(false)} />

      {/* Manual Token / Custom OAuth Setup Modal */}
      <Modal visible={showTokenModal} transparent animationType="slide" onRequestClose={() => setShowTokenModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>DIRECT TOKEN / CLIENT SETUP</Text>
              <TouchableOpacity onPress={() => setShowTokenModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDesc}>
                Enter a Google OAuth2 access token or configure your custom Google Cloud Client ID for direct connection.
              </Text>

              <Text style={styles.inputLabel}>OAUTH2 ACCESS TOKEN</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="ya29.a0..."
                placeholderTextColor={themeColors.textSecondary}
                value={tokenInput}
                onChangeText={setTokenInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>OPTIONAL: GOOGLE CLOUD CLIENT ID</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="xxxx.apps.googleusercontent.com"
                placeholderTextColor={themeColors.textSecondary}
                value={clientIdInput}
                onChangeText={setClientIdInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.primaryButton, isVerifyingToken && { opacity: 0.7 }]}
                onPress={handleVerifyManualToken}
                disabled={isVerifyingToken}
              >
                {isVerifyingToken ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>VERIFY & CONNECT</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (themeColors: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.hairline,
      backgroundColor: themeColors.surface,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      marginRight: spacing.sm,
      marginLeft: -spacing.xs,
    },
    headerSuper: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: themeColors.textSecondary,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: themeColors.text,
    },
    statusPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    statusPillActive: {
      backgroundColor: 'rgba(6, 214, 160, 0.1)',
      borderColor: 'rgba(6, 214, 160, 0.3)',
    },
    statusPillInactive: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderColor: themeColors.hairline,
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    statusPillTextActive: {
      color: '#06D6A0',
    },
    statusPillTextInactive: {
      color: themeColors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl * 2,
    },
    groupCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeColors.hairline,
      overflow: 'hidden',
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.hairline,
    },
    groupTitle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: themeColors.textSecondary,
    },
    cardInner: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    helperText: {
      fontSize: 13,
      lineHeight: 19,
      color: themeColors.textSecondary,
    },
    boldText: {
      fontWeight: '700',
      color: themeColors.text,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4285F4',
      paddingVertical: spacing.md,
      borderRadius: 8,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: themeColors.hairline,
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    secondaryButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.text,
    },
    accountProfileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    avatarPill: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#4285F4',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    accountInfo: {
      flex: 1,
    },
    accountNameText: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text,
    },
    accountEmailText: {
      fontSize: 12,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    scopeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    scopeBadgeText: {
      fontSize: 11,
      color: '#06D6A0',
      fontWeight: '600',
    },
    connectedActionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    actionPillButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: themeColors.hairline,
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    disconnectPill: {
      borderColor: 'rgba(239, 71, 111, 0.3)',
      backgroundColor: 'rgba(239, 71, 111, 0.06)',
    },
    actionPillButtonText: {
      fontSize: 11,
      fontWeight: '600',
      color: themeColors.text,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    rowLeft: {
      flex: 1,
      paddingRight: spacing.md,
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: themeColors.text,
    },
    rowDesc: {
      fontSize: 12,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: themeColors.hairline,
    },
    segmentedCard: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    segmentLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      color: themeColors.textSecondary,
    },
    pillsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    frequencyPill: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: themeColors.hairline,
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    frequencyPillActive: {
      backgroundColor: 'rgba(6, 214, 160, 0.15)',
      borderColor: '#06D6A0',
    },
    frequencyPillText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: themeColors.textSecondary,
    },
    frequencyPillTextActive: {
      color: '#06D6A0',
    },
    retentionDesc: {
      fontSize: 11,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    timeInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    timeInput: {
      width: 65,
      paddingVertical: 6,
      paddingHorizontal: spacing.xs,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: themeColors.hairline,
      color: themeColors.text,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    saveTimeButton: {
      backgroundColor: themeColors.text,
      paddingVertical: 7,
      paddingHorizontal: spacing.sm,
      borderRadius: 6,
    },
    saveTimeButtonText: {
      fontSize: 11,
      fontWeight: '700',
      color: themeColors.background,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.xs,
    },
    statusCol: {
      flex: 1,
    },
    statusLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      color: themeColors.textSecondary,
    },
    statusValue: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.text,
      marginTop: 2,
    },
    statusBadgeContainer: {
      marginLeft: spacing.md,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1,
      borderColor: themeColors.hairline,
    },
    badgeActive: {
      backgroundColor: 'rgba(6, 214, 160, 0.1)',
      borderColor: 'rgba(6, 214, 160, 0.3)',
    },
    badgeDanger: {
      backgroundColor: 'rgba(239, 71, 111, 0.1)',
      borderColor: 'rgba(239, 71, 111, 0.3)',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: themeColors.textSecondary,
    },
    badgeActiveText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#06D6A0',
    },
    badgeDangerText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#EF476F',
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(239, 71, 111, 0.08)',
      padding: spacing.sm,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(239, 71, 111, 0.25)',
    },
    errorBannerText: {
      fontSize: 12,
      color: '#EF476F',
      flex: 1,
    },
    loadingContainer: {
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    loadingText: {
      fontSize: 12,
      color: themeColors.textSecondary,
    },
    emptyContainer: {
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    emptyText: {
      fontSize: 12,
      color: themeColors.textSecondary,
      textAlign: 'center',
      maxWidth: 260,
    },
    backupItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    backupItemLeft: {
      flex: 1,
      paddingRight: spacing.md,
    },
    backupItemName: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.text,
    },
    backupItemMeta: {
      fontSize: 11,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    backupItemActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    restoreBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: themeColors.hairline,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    restoreBtnText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: themeColors.text,
    },
    deleteIconBtn: {
      padding: 6,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: spacing.lg,
      maxHeight: '80%',
      borderTopWidth: 1,
      borderColor: themeColors.hairline,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    modalTitle: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 1,
      color: themeColors.text,
    },
    modalDesc: {
      fontSize: 12,
      lineHeight: 18,
      color: themeColors.textSecondary,
      marginBottom: spacing.md,
    },
    inputLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      color: themeColors.textSecondary,
      marginBottom: spacing.xs,
    },
    modalTextInput: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: themeColors.hairline,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: themeColors.text,
      fontSize: 13,
      marginBottom: spacing.md,
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
  });
