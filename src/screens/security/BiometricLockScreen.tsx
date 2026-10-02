/**
 * BiometricLockScreen — Simplizum Architectural Edition
 *
 * Full-screen cryptographic authorization shield:
 * - Minimal, high-contrast, razor-thin aesthetic
 * - Native biometric prompt (Face ID / Fingerprint)
 * - Sharp numeric PIN entry fallback
 * - Hardware lockout tracking with second countdown
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import {
  authenticateWithBiometrics,
  checkBiometricCapabilities,
  getBiometricIcon,
  getBiometricTypeName,
} from '../../services/biometric/biometricAuth';
import { verifyPin, validatePinFormat } from '../../services/biometric/pinUtils';
import { lightHaptic, mediumHaptic, errorHaptic } from '../../services/haptics/hapticFeedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface BiometricLockScreenProps {
  onAuthenticated: () => void;
}

export const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({ onAuthenticated }) => {
  const themeColors = useThemeColors();
  const { securitySettings, updateSecuritySettings } = useSettingsStore();

  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'faceId' | 'iris' | 'none'>('none');
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [hasAuthenticated, setHasAuthenticated] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    if (!hasAuthenticated) {
      checkCapabilities();
      checkLockout();
    }
  }, [hasAuthenticated]);

  const checkCapabilities = async () => {
    const capabilities = await checkBiometricCapabilities();
    setBiometricType(capabilities.biometricType);

    if (capabilities.isAvailable && securitySettings.authType === 'biometric') {
      setTimeout(() => handleBiometricAuth(), 400);
    }
  };

  const checkLockout = () => {
    if (securitySettings.lockoutUntil) {
      const now = Date.now();
      if (now < securitySettings.lockoutUntil) {
        setIsLocked(true);
        const remaining = Math.ceil((securitySettings.lockoutUntil - now) / 1000);
        setLockoutRemaining(remaining);

        const interval = setInterval(() => {
          const newRemaining = Math.ceil((securitySettings.lockoutUntil! - Date.now()) / 1000);
          if (newRemaining <= 0) {
            setIsLocked(false);
            clearInterval(interval);
            updateSecuritySettings({ lockoutUntil: null, failedAttempts: 0 });
          } else {
            setLockoutRemaining(newRemaining);
          }
        }, 1000);

        return () => clearInterval(interval);
      } else {
        updateSecuritySettings({ lockoutUntil: null, failedAttempts: 0 });
      }
    }
  };

  const handleBiometricAuth = async () => {
    if (hasAuthenticated || isAuthenticating) return;

    setIsAuthenticating(true);
    lightHaptic();

    const result = await authenticateWithBiometrics();

    if (result.success) {
      setHasAuthenticated(true);
      mediumHaptic();
      updateSecuritySettings({
        lastAuthTime: Date.now(),
        failedAttempts: 0,
      });
      onAuthenticated();
    } else {
      errorHaptic();
      setShowPinInput(true);
    }

    setIsAuthenticating(false);
  };

  const handlePinSubmit = () => {
    lightHaptic();

    if (isLocked) {
      errorHaptic();
      Alert.alert(
        'HARDWARE LOCKOUT',
        `Too many failed attempts. Try again in ${lockoutRemaining} seconds.`
      );
      return;
    }

    const validation = validatePinFormat(pin);
    if (!validation.valid) {
      errorHaptic();
      Alert.alert('INVALID PIN', validation.error);
      return;
    }

    setIsAuthenticating(true);

    if (securitySettings.pinHash && verifyPin(pin, securitySettings.pinHash)) {
      setHasAuthenticated(true);
      mediumHaptic();
      updateSecuritySettings({
        lastAuthTime: Date.now(),
        failedAttempts: 0,
      });
      setPin('');
      onAuthenticated();
    } else {
      errorHaptic();
      const newFailedAttempts = securitySettings.failedAttempts + 1;

      if (newFailedAttempts >= securitySettings.maxFailedAttempts) {
        const lockoutUntil = Date.now() + 5 * 60 * 1000;
        updateSecuritySettings({
          failedAttempts: newFailedAttempts,
          lockoutUntil,
        });
        setIsLocked(true);
        setLockoutRemaining(300);
        Alert.alert('LOCKOUT ACTIVATED', 'Account locked for 5 minutes due to repeated failed entries.');
      } else {
        updateSecuritySettings({ failedAttempts: newFailedAttempts });
        Alert.alert(
          'INCORRECT PIN',
          `${securitySettings.maxFailedAttempts - newFailedAttempts} attempts remaining before lockout.`
        );
      }
      setPin('');
    }

    setIsAuthenticating(false);
  };

  return (
    <View style={styles.root}>
      <View style={styles.centerCard}>
        {/* Architectural Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardSuper}>HARDWARE ENCLAVE ACCESS</Text>
          <Text style={styles.cardTitle}>ZERO WALLET</Text>
        </View>

        {/* Lock status row */}
        <View style={styles.statusBox}>
          <MaterialCommunityIcons
            name={isLocked ? 'shield-alert' : 'shield-key-outline'}
            size={22}
            color={isLocked ? '#FF3B30' : themeColors.text}
          />
          <Text style={[styles.statusText, isLocked ? styles.statusTextDanger : null]}>
            {isLocked ? 'SYSTEM LOCKED' : 'AUTHENTICATION REQUIRED'}
          </Text>
        </View>

        {isLocked ? (
          <View style={styles.lockoutBox}>
            <Text style={styles.lockoutTitle}>LOCKOUT IN EFFECT</Text>
            <Text style={styles.lockoutSub}>
              Enclave locked for {lockoutRemaining}s due to invalid security attempts.
            </Text>
          </View>
        ) : (
          <>
            {!showPinInput && securitySettings.authType === 'biometric' ? (
              <View style={styles.authActionArea}>
                <TouchableOpacity
                  style={styles.primaryAuthButton}
                  onPress={handleBiometricAuth}
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <ActivityIndicator color={themeColors.background} size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={getBiometricIcon(biometricType)}
                        size={20}
                        color={themeColors.background}
                      />
                      <Text style={styles.primaryAuthText}>
                        UNLOCK WITH {getBiometricTypeName(biometricType).toUpperCase()}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fallbackButton}
                  onPress={() => {
                    lightHaptic();
                    setShowPinInput(true);
                  }}
                >
                  <Text style={styles.fallbackText}>USE MASTER PIN INSTEAD</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.authActionArea}>
                <Text style={styles.pinInstruction}>ENTER 4-6 DIGIT MASTER PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                  placeholder="····"
                  placeholderTextColor={themeColors.textSecondary}
                  onSubmitEditing={handlePinSubmit}
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.primaryAuthButton, pin.length < 4 ? styles.buttonMuted : null]}
                  onPress={handlePinSubmit}
                  disabled={isAuthenticating || pin.length < 4}
                >
                  {isAuthenticating ? (
                    <ActivityIndicator color={themeColors.background} size="small" />
                  ) : (
                    <Text style={styles.primaryAuthText}>VERIFY & AUTHORIZE</Text>
                  )}
                </TouchableOpacity>

                {securitySettings.authType === 'biometric' && (
                  <TouchableOpacity
                    style={styles.fallbackButton}
                    onPress={() => {
                      lightHaptic();
                      setShowPinInput(false);
                      setPin('');
                    }}
                  >
                    <Text style={styles.fallbackText}>
                      SWITCH TO {getBiometricTypeName(biometricType).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>SECURE CRYPTOGRAPHIC ENCLAVE · SHA-256</Text>
      </View>
    </View>
  );
};

export default BiometricLockScreen;

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    centerCard: {
      width: '100%',
      maxWidth: 380,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      padding: spacing.xl,
    },
    cardHeader: {
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      paddingBottom: spacing.md,
      marginBottom: spacing.md,
    },
    cardSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
      marginBottom: 2,
    },
    cardTitle: {
      ...typography.h2,
      color: theme.text,
      letterSpacing: 1,
      fontWeight: '700',
    },
    statusBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 2,
      backgroundColor: theme.background,
      marginBottom: spacing.lg,
    },
    statusText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.8,
    },
    statusTextDanger: {
      color: '#FF3B30',
    },
    lockoutBox: {
      borderWidth: 1,
      borderColor: '#FF3B30',
      backgroundColor: '#FF3B3010',
      padding: spacing.md,
      borderRadius: 2,
    },
    lockoutTitle: {
      ...typography.caption,
      color: '#FF3B30',
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 2,
    },
    lockoutSub: {
      ...typography.body,
      color: theme.text,
      fontSize: 12,
    },
    authActionArea: {
      width: '100%',
    },
    primaryAuthButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + 2,
      backgroundColor: theme.text,
      paddingVertical: spacing.md,
      borderRadius: 2,
    },
    primaryAuthText: {
      ...typography.caption,
      color: theme.background,
      fontWeight: '700',
      letterSpacing: 1,
      fontSize: 12,
    },
    buttonMuted: {
      opacity: 0.4,
    },
    fallbackButton: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    fallbackText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      textDecorationLine: 'underline',
    },
    pinInstruction: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    pinInput: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      color: theme.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: 2,
      fontFamily: 'monospace',
      fontSize: 22,
      letterSpacing: 12,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    footer: {
      position: 'absolute',
      bottom: spacing.xl,
      alignItems: 'center',
    },
    footerText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      letterSpacing: 1,
      opacity: 0.6,
    },
  });
