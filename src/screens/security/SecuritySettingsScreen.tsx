/**
 * Purpose: Configure app security settings (biometric/PIN)
 *
 * Features:
 * - Enable/disable app lock
 * - Choose biometric or PIN based on device capabilities
 * - Set up PIN
 * - Change PIN
 * - Switch between auth methods
 */

import React, { useState, useEffect } from 'react';
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
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const AUTO_LOCK_OPTIONS = [
  { seconds: 0, label: 'Immediately', hint: 'Lock every time you leave the app' },
  { seconds: 30, label: 'After 30 seconds', hint: 'Brief grace period' },
  { seconds: 60, label: 'After 1 minute', hint: 'Quick check-ins stay unlocked' },
  { seconds: 300, label: 'After 5 minutes', hint: 'Relaxed for active use' },
  { seconds: 1800, label: 'After 30 minutes', hint: 'Only lock after long breaks' },
];

const SecuritySettingsScreen = ({ navigation }: any) => {
  const themeColors = useThemeColors();
  const { securitySettings, updateSecuritySettings } = useSettingsStore();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'faceId' | 'iris' | 'none'>('none');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [enableBiometricAfterPin, setEnableBiometricAfterPin] = useState(false);

  // Check biometric capabilities on mount
  useEffect(() => {
    checkCapabilities();
  }, []);

  const checkCapabilities = async () => {
    const capabilities = await checkBiometricCapabilities();
    setBiometricAvailable(capabilities.isAvailable);
    setBiometricType(capabilities.biometricType);
  };

  // Toggle app lock
  const handleToggleAppLock = async () => {
    if (securitySettings.isEnabled) {
      // Disable app lock
      Alert.alert(
        'Disable App Lock',
        'Are you sure you want to disable app lock? Your wallet will be accessible without authentication.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => lightHaptic(),
          },
          {
            text: 'Disable',
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
      // Enable app lock - show setup options
      if (biometricAvailable) {
        Alert.alert(
          'Enable App Lock',
          'Choose your security method:',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => lightHaptic(),
            },
            {
              text: 'PIN Only',
              onPress: () => {
                lightHaptic();
                setShowPinSetup(true);
              },
            },
            {
              text: `${getBiometricTypeName(biometricType)} + PIN`,
              onPress: () => {
                mediumHaptic();
                // Show PIN setup first, then enable biometric
                Alert.alert(
                  'Setup PIN Backup',
                  `You'll need to set up a PIN as backup for ${getBiometricTypeName(biometricType)} authentication.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        lightHaptic();
                        setEnableBiometricAfterPin(true);
                        setShowPinSetup(true);
                      },
                    },
                  ]
                );
              },
            },
          ]
        );
      } else {
        // No biometric, must use PIN
        lightHaptic();
        setShowPinSetup(true);
      }
    }
  };

  // Setup PIN
  const handleSetupPin = () => {
    if (!pin || !confirmPin) {
      Alert.alert('Error', 'Please enter PIN and confirm');
      return;
    }

    const validation = validatePinFormat(pin);
    if (!validation.valid) {
      Alert.alert('Invalid PIN', validation.error);
      return;
    }

    if (isPinTooSimple(pin)) {
      Alert.alert(
        'Weak PIN',
        'This PIN is too simple. Please choose a more secure PIN.'
      );
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    setIsSettingPin(true);
    const pinHash = hashPin(pin);

    // Check if we're setting up biometric with PIN backup
    if (enableBiometricAfterPin) {
      updateSecuritySettings({
        isEnabled: true,
        authType: 'biometric',
        pinHash,
        biometricEnabled: true,
      });
      mediumHaptic();
      setShowPinSetup(false);
      setPin('');
      setConfirmPin('');
      setIsSettingPin(false);
      setEnableBiometricAfterPin(false);
      Alert.alert('Success', `${getBiometricTypeName(biometricType)} with PIN backup has been set successfully`);
    } else {
      updateSecuritySettings({
        isEnabled: true,
        authType: 'pin',
        pinHash,
        biometricEnabled: false,
      });
      mediumHaptic();
      setShowPinSetup(false);
      setPin('');
      setConfirmPin('');
      setIsSettingPin(false);
      Alert.alert('Success', 'PIN has been set successfully');
    }
  };

  // Change PIN
  const handleChangePin = () => {
    lightHaptic();
    setShowPinSetup(true);
  };

  // Switch to biometric (if available)
  const handleSwitchToBiometric = () => {
    if (!biometricAvailable) {
      Alert.alert('Not Available', 'Biometric authentication is not available on this device');
      return;
    }

    // PIN is already set, so we can just switch
    Alert.alert(
      'Switch to Biometric',
      `Use ${getBiometricTypeName(biometricType)} with PIN backup?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => lightHaptic(),
        },
        {
          text: 'Switch',
          onPress: () => {
            mediumHaptic();
            updateSecuritySettings({
              authType: 'biometric',
              biometricEnabled: true,
            });
            Alert.alert('Success', `Switched to ${getBiometricTypeName(biometricType)} with PIN backup`);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Master Toggle */}
      <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          App Lock
        </Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.semantic.warningLight }]}>
              <MaterialCommunityIcons
                name="shield-lock"
                size={20}
                color={colors.semantic.warning}
              />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>
                Secure App Open
              </Text>
              <Text style={[styles.settingDescription, { color: themeColors.textSecondary }]}>
                Require authentication to open app
              </Text>
            </View>
          </View>
          <Switch
            value={securitySettings.isEnabled}
            onValueChange={handleToggleAppLock}
            trackColor={{
              false: colors.neutral.gray300,
              true: colors.primary.light,
            }}
            thumbColor={
              securitySettings.isEnabled
                ? colors.primary.main
                : colors.neutral.gray500
            }
          />
        </View>
      </View>

      {/* Auto-lock delay (only shown if enabled) */}
      {securitySettings.isEnabled && (
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
            Auto-Lock Delay
          </Text>
          <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>
            Lock the app after being away this long
          </Text>

          {AUTO_LOCK_OPTIONS.map((option) => {
            const isSelected = securitySettings.autoLockTimeout === option.seconds;
            return (
              <TouchableOpacity
                key={option.seconds}
                style={styles.settingRow}
                onPress={() => {
                  lightHaptic();
                  updateSecuritySettings({ autoLockTimeout: option.seconds });
                }}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: colors.semantic.infoLight }]}>
                    <MaterialCommunityIcons
                      name="timer-outline"
                      size={20}
                      color={colors.semantic.info}
                    />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: themeColors.text }]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.settingDescription, { color: themeColors.textSecondary }]}>
                      {option.hint}
                    </Text>
                  </View>
                </View>
                {isSelected ? (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={24}
                    color={colors.primary.main}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="circle-outline"
                    size={24}
                    color={themeColors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Authentication Method (only shown if enabled) */}
      {securitySettings.isEnabled && (
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
            Authentication Method
          </Text>

          {/* Current method */}
          <View style={[styles.infoBox, { backgroundColor: colors.primary.light + '30' }]}>
            <MaterialCommunityIcons
              name={
                securitySettings.authType === 'biometric'
                  ? getBiometricIcon(biometricType)
                  : 'lock-outline'
              }
              size={20}
              color={colors.primary.main}
            />
            <Text style={[styles.infoText, { color: colors.primary.main }]}>
              Currently using:{' '}
              {securitySettings.authType === 'biometric'
                ? `${getBiometricTypeName(biometricType)} with PIN backup`
                : 'PIN only'}
            </Text>
          </View>

          {/* Change PIN (if using PIN) */}
          {securitySettings.authType === 'pin' && (
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomWidth: biometricAvailable ? 1 : 0, borderBottomColor: themeColors.border }]}
              onPress={handleChangePin}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.semantic.infoLight }]}>
                  <MaterialCommunityIcons
                    name="lock-reset"
                    size={20}
                    color={colors.semantic.info}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: themeColors.text }]}>
                    Change PIN
                  </Text>
                  <Text style={[styles.settingDescription, { color: themeColors.textSecondary }]}>
                    Update your PIN code
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          )}

          {/* Change PIN backup (if using biometric) */}
          {securitySettings.authType === 'biometric' && (
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomWidth: biometricAvailable ? 1 : 0, borderBottomColor: themeColors.border }]}
              onPress={handleChangePin}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.semantic.infoLight }]}>
                  <MaterialCommunityIcons
                    name="lock-reset"
                    size={20}
                    color={colors.semantic.info}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: themeColors.text }]}>
                    Change PIN Backup
                  </Text>
                  <Text style={[styles.settingDescription, { color: themeColors.textSecondary }]}>
                    Update your backup PIN code
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          )}

          {/* Switch to biometric (if using PIN and biometric available) */}
          {securitySettings.authType === 'pin' && biometricAvailable && (
            <TouchableOpacity
              style={styles.settingRow}
              onPress={handleSwitchToBiometric}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.semantic.successLight }]}>
                  <MaterialCommunityIcons
                    name={getBiometricIcon(biometricType)}
                    size={20}
                    color={colors.semantic.success}
                  />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: themeColors.text }]}>
                    Use {getBiometricTypeName(biometricType)}
                  </Text>
                  <Text style={[styles.settingDescription, { color: themeColors.textSecondary }]}>
                    Switch to biometric authentication
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* PIN Setup Modal */}
      <Modal
        visible={showPinSetup}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPinSetup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {enableBiometricAfterPin
                ? `Set Up PIN Backup`
                : securitySettings.pinHash ? 'Change PIN' : 'Set Up PIN'}
            </Text>

            <TextInput
              style={[styles.pinInput, {
                backgroundColor: themeColors.background,
                borderColor: themeColors.border,
                color: themeColors.text,
              }]}
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              placeholder="Enter PIN (4-6 digits)"
              placeholderTextColor={themeColors.textSecondary}
            />

            <TextInput
              style={[styles.pinInput, {
                backgroundColor: themeColors.background,
                borderColor: themeColors.border,
                color: themeColors.text,
              }]}
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              placeholder="Confirm PIN"
              placeholderTextColor={themeColors.textSecondary}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.neutral.gray300 }]}
                onPress={() => {
                  lightHaptic();
                  setShowPinSetup(false);
                  setPin('');
                  setConfirmPin('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.neutral.gray700 }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary.main }]}
                onPress={handleSetupPin}
                disabled={isSettingPin}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {isSettingPin ? 'Setting...' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    ...typography.caption,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    ...typography.caption,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  pinInput: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
});

export default SecuritySettingsScreen;
