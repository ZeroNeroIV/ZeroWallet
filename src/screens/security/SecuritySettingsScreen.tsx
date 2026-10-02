/**
 * SecuritySettingsScreen — Simplizum Architectural Edition
 *
 * In-Place Security Hub:
 * - Direct toggle for App Shield (Biometrics / PIN)
 * - In-place auto-lock timeout interval chips (Immediately, 30s, 1m, 5m, 30m)
 * - Architectural modal for PIN setup and updates
 * - Device biometric capabilities detection
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import {
  checkBiometricCapabilities,
  getBiometricTypeName,
  getBiometricIcon,
} from '../../services/biometric/biometricAuth';
import {
  hashPin,
  validatePinFormat,
  isPinTooSimple,
} from '../../services/biometric/pinUtils';
import { lightHaptic, mediumHaptic, errorHaptic } from '../../services/haptics/hapticFeedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const AUTO_LOCK_OPTIONS = [
  { seconds: 0, label: 'IMMEDIATELY', sub: 'On background' },
  { seconds: 30, label: '30 SEC', sub: 'Brief grace' },
  { seconds: 60, label: '1 MIN', sub: 'Standard' },
  { seconds: 300, label: '5 MIN', sub: 'Extended' },
  { seconds: 1800, label: '30 MIN', sub: 'Relaxed' },
];

export default function SecuritySettingsScreen({ navigation }: any) {
  const themeColors = useThemeColors();
  const { securitySettings, updateSecuritySettings } = useSettingsStore();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'faceId' | 'iris' | 'none'>('none');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [enableBiometricAfterPin, setEnableBiometricAfterPin] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    (async () => {
      const caps = await checkBiometricCapabilities();
      setBiometricAvailable(caps.isAvailable);
      setBiometricType(caps.biometricType);
    })();
  }, []);

  const handleToggleAppLock = () => {
    if (securitySettings.isEnabled) {
      Alert.alert(
        'DISABLE APP SHIELD',
        'Your ledger and private vault will be accessible without authentication upon opening.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => lightHaptic() },
          {
            text: 'Disable Shield',
            style: 'destructive',
            onPress: () => {
              mediumHaptic();
              updateSecuritySettings({
                isEnabled: false,
                authType: 'none',
                pinHash: null,
                lastAuthTime: null,
                failedAttempts: 0,
                lockoutUntil: null,
              });
            },
          },
        ]
      );
    } else {
      if (biometricAvailable) {
        Alert.alert(
          'ENABLE APP SHIELD',
          'Select your preferred primary authentication method:',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => lightHaptic() },
            {
              text: 'PIN Only',
              onPress: () => {
                lightHaptic();
                setEnableBiometricAfterPin(false);
                setPin('');
                setConfirmPin('');
                setShowPinModal(true);
              },
            },
            {
              text: `${getBiometricTypeName(biometricType)} + PIN Backup`,
              onPress: () => {
                mediumHaptic();
                setEnableBiometricAfterPin(true);
                setPin('');
                setConfirmPin('');
                setShowPinModal(true);
              },
            },
          ]
        );
      } else {
        lightHaptic();
        setEnableBiometricAfterPin(false);
        setPin('');
        setConfirmPin('');
        setShowPinModal(true);
      }
    }
  };

  const handleSavePin = () => {
    if (!pin || !confirmPin) {
      errorHaptic();
      Alert.alert('Required', 'Please enter and confirm your PIN.');
      return;
    }

    const validation = validatePinFormat(pin);
    if (!validation.valid) {
      errorHaptic();
      Alert.alert('Invalid PIN', validation.error);
      return;
    }

    if (isPinTooSimple(pin)) {
      errorHaptic();
      Alert.alert('Weak PIN', 'Avoid simple sequences (like 1234) or repeated digits (like 1111).');
      return;
    }

    if (pin !== confirmPin) {
      errorHaptic();
      Alert.alert('Mismatch', 'PIN entries do not match.');
      return;
    }

    setIsSavingPin(true);
    const pinHash = hashPin(pin);

    if (enableBiometricAfterPin) {
      updateSecuritySettings({
        isEnabled: true,
        authType: 'biometric',
        pinHash,
        biometricEnabled: true,
      });
      mediumHaptic();
      setShowPinModal(false);
      setIsSavingPin(false);
      Alert.alert('SHIELD ACTIVATED', `${getBiometricTypeName(biometricType)} and PIN backup are now active.`);
    } else {
      updateSecuritySettings({
        isEnabled: true,
        authType: 'pin',
        pinHash,
        biometricEnabled: false,
      });
      mediumHaptic();
      setShowPinModal(false);
      setIsSavingPin(false);
      Alert.alert('SHIELD ACTIVATED', 'Master PIN protection is now active.');
    }
  };

  const handleSwitchToBiometric = () => {
    if (!biometricAvailable) {
      Alert.alert('Unavailable', 'Biometrics are not supported on this device.');
      return;
    }
    mediumHaptic();
    updateSecuritySettings({
      authType: 'biometric',
      biometricEnabled: true,
    });
  };

  const handleSwitchToPinOnly = () => {
    mediumHaptic();
    updateSecuritySettings({
      authType: 'pin',
      biometricEnabled: false,
    });
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            lightHaptic();
            navigation.goBack();
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={themeColors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerSuper}>SECURITY & ARCHITECTURE</Text>
          <Text style={styles.headerTitle}>APP SHIELD</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={[styles.statusText, securitySettings.isEnabled ? styles.statusActive : null]}>
            {securitySettings.isEnabled ? 'ARMED' : 'DISARMED'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* CARD 1: MASTER ACCESS SWITCH */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>MASTER ACCESS CONTROL</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Enforce App Shield</Text>
              <Text style={styles.rowDesc}>Require authentication each time ZeroWallet is opened</Text>
            </View>
            <Switch
              value={securitySettings.isEnabled}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>
        </View>

        {/* CARD 2: AUTHENTICATION PROTOCOL */}
        {securitySettings.isEnabled && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTitle}>AUTHENTICATION PROTOCOL</Text>
            </View>

            {biometricAvailable && (
              <>
                <TouchableOpacity
                  style={styles.row}
                  onPress={handleSwitchToBiometric}
                >
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowLabel}>
                      {getBiometricTypeName(biometricType)} + PIN Backup
                    </Text>
                    <Text style={styles.rowDesc}>Instant biometric unlock with hardware fallback</Text>
                  </View>
                  <View style={styles.rowRight}>
                    {securitySettings.authType === 'biometric' ? (
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>ACTIVE</Text>
                      </View>
                    ) : (
                      <Text style={styles.inactiveTagText}>TAP TO USE</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            )}

            <TouchableOpacity
              style={styles.row}
              onPress={handleSwitchToPinOnly}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>PIN Only</Text>
                <Text style={styles.rowDesc}>Cryptographic 4-6 digit passcode</Text>
              </View>
              <View style={styles.rowRight}>
                {securitySettings.authType === 'pin' ? (
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>ACTIVE</Text>
                  </View>
                ) : (
                  <Text style={styles.inactiveTagText}>TAP TO USE</Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                lightHaptic();
                setPin('');
                setConfirmPin('');
                setShowPinModal(true);
              }}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>Change Master PIN</Text>
                <Text style={styles.rowDesc}>Update or re-authorize your passcode</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* CARD 3: AUTO-LOCK TIMEOUT INTERVAL */}
        {securitySettings.isEnabled && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTitle}>AUTO-LOCK DELAY</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.sectionCaption}>
                Lock the application after remaining in the background for:
              </Text>
              <View style={styles.intervalGrid}>
                {AUTO_LOCK_OPTIONS.map((opt) => {
                  const isSelected = securitySettings.autoLockTimeout === opt.seconds;
                  return (
                    <TouchableOpacity
                      key={opt.seconds}
                      style={[styles.intervalChip, isSelected ? styles.intervalChipActive : null]}
                      onPress={() => {
                        lightHaptic();
                        updateSecuritySettings({ autoLockTimeout: opt.seconds });
                      }}
                    >
                      <Text
                        style={[styles.intervalChipText, isSelected ? styles.intervalChipTextActive : null]}
                      >
                        {opt.label}
                      </Text>
                      <Text
                        style={[styles.intervalChipSub, isSelected ? styles.intervalChipSubActive : null]}
                      >
                        {opt.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* CARD 4: CRYPTOGRAPHIC SPECS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>PRIVACY & SECURITY SPECS</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>ENCRYPTION STANDARD</Text>
            <Text style={styles.specVal}>PBKDF2 SHA-256 SALT</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>BIOMETRIC VAULT</Text>
            <Text style={styles.specVal}>HARDWARE KEYSTORE / ENCLAVE</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>NETWORK EXPOSURE</Text>
            <Text style={styles.specVal}>ZERO CLOUD / 100% LOCAL</Text>
          </View>
        </View>
      </ScrollView>

      {/* Architectural PIN Modal */}
      <Modal
        visible={showPinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPinModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalSuper}>SECURITY AUTHORIZATION</Text>
              <Text style={styles.modalTitle}>
                {securitySettings.pinHash ? 'UPDATE MASTER PIN' : 'CONFIGURE MASTER PIN'}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ENTER NEW PIN (4-6 DIGITS)</Text>
              <TextInput
                style={styles.pinTextInput}
                value={pin}
                onChangeText={setPin}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                placeholder="····"
                placeholderTextColor={themeColors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CONFIRM NEW PIN</Text>
              <TextInput
                style={styles.pinTextInput}
                value={confirmPin}
                onChangeText={setConfirmPin}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                placeholder="····"
                placeholderTextColor={themeColors.textSecondary}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  lightHaptic();
                  setShowPinModal(false);
                }}
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSavePin}
                disabled={isSavingPin}
              >
                {isSavingPin ? (
                  <ActivityIndicator size="small" color={themeColors.background} />
                ) : (
                  <Text style={styles.saveBtnText}>SAVE & ARM</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      gap: spacing.sm,
    },
    backButton: {
      width: 36,
      height: 36,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitles: {
      flex: 1,
    },
    headerSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
    },
    headerTitle: {
      ...typography.h3,
      color: theme.text,
      letterSpacing: 0.5,
      fontWeight: '700',
    },
    statusPill: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 2,
    },
    statusText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    statusActive: {
      color: theme.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    cardHeader: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
    },
    cardHeaderTitle: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
    cardBody: {
      padding: spacing.md,
    },
    sectionCaption: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 12,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      minHeight: 56,
    },
    rowLeft: {
      flex: 1,
      marginRight: spacing.md,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowLabel: {
      ...typography.body,
      color: theme.text,
      fontWeight: '600',
      fontSize: 14,
      marginBottom: 2,
    },
    rowDesc: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 12,
    },
    divider: {
      height: 1,
      backgroundColor: theme.hairline || theme.border,
      marginLeft: spacing.md,
    },
    activeTag: {
      borderWidth: 1,
      borderColor: theme.text,
      backgroundColor: theme.text,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: 2,
    },
    activeTagText: {
      ...typography.caption,
      color: theme.background,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    inactiveTagText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    intervalGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    intervalChip: {
      flex: 1,
      minWidth: '30%',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    intervalChipActive: {
      borderColor: theme.text,
      backgroundColor: theme.text,
    },
    intervalChipText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.5,
    },
    intervalChipTextActive: {
      color: theme.background,
    },
    intervalChipSub: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      marginTop: 2,
    },
    intervalChipSubActive: {
      color: theme.background,
      opacity: 0.8,
    },
    specRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
    },
    specLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: '600',
    },
    specVal: {
      ...typography.caption,
      color: theme.text,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      fontFamily: 'monospace',
    },
    // Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalBox: {
      width: '100%',
      backgroundColor: theme.card || theme.surface,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      padding: spacing.lg,
    },
    modalHeader: {
      marginBottom: spacing.md,
    },
    modalSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
      marginBottom: 2,
    },
    modalTitle: {
      ...typography.h3,
      color: theme.text,
      fontWeight: '700',
    },
    inputGroup: {
      marginBottom: spacing.md,
    },
    inputLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    pinTextInput: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      color: theme.text,
      borderRadius: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 18,
      fontFamily: 'monospace',
      letterSpacing: 8,
      textAlign: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    cancelBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelBtnText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      letterSpacing: 1,
    },
    saveBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: theme.text,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 120,
    },
    saveBtnText: {
      ...typography.caption,
      color: theme.background,
      fontWeight: '700',
      letterSpacing: 1,
    },
  });
