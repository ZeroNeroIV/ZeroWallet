/**
 * Purpose: Provides haptic feedback utilities for enhanced user interaction
 * 
 * Inputs: None (service functions take no parameters or optional intensity)
 * 
 * Outputs:
 *   - Various feedback functions that trigger haptic responses
 * 
 * Side effects:
 *   - Triggers device vibration/haptic motors
 *   - Respects settings store haptic preference
 */

import { Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSettingsStore } from '../../store/settingsStore';

// Haptic feedback options
const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/**
 * Purpose: Check if haptic feedback is enabled in settings
 * 
 * Inputs: None
 * 
 * Outputs:
 *   - Returns (boolean): true if haptic feedback enabled
 * 
 * Side effects: None
 */
const isHapticEnabled = (): boolean => {
  return useSettingsStore.getState().appSettings.hapticFeedback;
};

/**
 * Purpose: Light haptic feedback for subtle interactions (button presses, toggles)
 * 
 * Inputs: None
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Triggers light haptic feedback if enabled
 */
export const lightHaptic = () => {
  if (!isHapticEnabled()) return;
  
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('impactLight', options);
  } else {
    ReactNativeHapticFeedback.trigger('impactLight', options);
  }
};

/**
 * Purpose: Medium haptic feedback for standard interactions (selections, confirmations)
 * 
 * Inputs: None
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Triggers medium haptic feedback if enabled
 */
export const mediumHaptic = () => {
  if (!isHapticEnabled()) return;
  
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('impactMedium', options);
  } else {
    ReactNativeHapticFeedback.trigger('impactMedium', options);
  }
};

/**
 * Purpose: Heavy haptic feedback for important actions (delete, errors)
 * 
 * Inputs: None
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Triggers heavy haptic feedback if enabled
 */
export const heavyHaptic = () => {
  if (!isHapticEnabled()) return;
  
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('impactHeavy', options);
  } else {
    ReactNativeHapticFeedback.trigger('impactHeavy', options);
  }
};

/**
 * Purpose: Success haptic feedback for successful operations
 * 
 * Inputs: None
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Triggers success haptic pattern if enabled
 */
export const successHaptic = () => {
  if (!isHapticEnabled()) return;
  
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('notificationSuccess', options);
  } else {
    ReactNativeHapticFeedback.trigger('notificationSuccess', options);
  }
};

/**
 * Purpose: Warning haptic feedback for warnings or caution needed
 * 
 * Inputs: None
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Triggers warning haptic pattern if enabled
 */
export const warningHaptic = () => {
  if (!isHapticEnabled()) return;
  
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('notificationWarning', options);
  } else {
    ReactNativeHapticFeedback.trigger('notificationWarning', options);
  }
};

/**
 * Purpose: Error haptic feedback for errors or failed operations
 * 
 * Inputs: None
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Triggers error haptic pattern if enabled
 */
export const errorHaptic = () => {
  if (!isHapticEnabled()) return;
  
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('notificationError', options);
  } else {
    ReactNativeHapticFeedback.trigger('notificationError', options);
  }
};

/**
 * Purpose: Selection haptic feedback for item selection in lists
 * 
 * Inputs: None
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Triggers selection haptic feedback if enabled
 */
export const selectionHaptic = () => {
  if (!isHapticEnabled()) return;
  
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('selection', options);
  } else {
    ReactNativeHapticFeedback.trigger('selection', options);
  }
};

/**
 * Purpose: Rigid haptic feedback for hard stops or boundaries
 * 
 * Inputs: None
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Triggers rigid haptic feedback if enabled (iOS only)
 */
export const rigidHaptic = () => {
  if (!isHapticEnabled()) return;
  
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('rigid', options);
  } else {
    mediumHaptic(); // Fallback to medium on Android
  }
};

/**
 * Purpose: Soft haptic feedback for gentle interactions
 * 
 * Inputs: None
 * 
 * Outputs: None
 * 
 * Side effects:
 *   - Triggers soft haptic feedback if enabled (iOS only)
 */
export const softHaptic = () => {
  if (!isHapticEnabled()) return;
  
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('soft', options);
  } else {
    lightHaptic(); // Fallback to light on Android
  }
};

/**
 * Universal haptic trigger helper
 */
export const triggerHaptic = (
  type:
    | 'impactLight'
    | 'impactMedium'
    | 'impactHeavy'
    | 'selection'
    | 'success'
    | 'warning'
    | 'error'
    | 'notificationSuccess'
    | 'notificationWarning'
    | 'notificationError' = 'impactLight'
) => {
  switch (type) {
    case 'impactLight':
      return lightHaptic();
    case 'impactMedium':
      return mediumHaptic();
    case 'impactHeavy':
      return heavyHaptic();
    case 'selection':
      return selectionHaptic();
    case 'success':
    case 'notificationSuccess':
      return successHaptic();
    case 'warning':
    case 'notificationWarning':
      return warningHaptic();
    case 'error':
    case 'notificationError':
      return errorHaptic();
    default:
      return lightHaptic();
  }
};

// Export all haptic functions
export default {
  light: lightHaptic,
  medium: mediumHaptic,
  heavy: heavyHaptic,
  success: successHaptic,
  warning: warningHaptic,
  error: errorHaptic,
  selection: selectionHaptic,
  rigid: rigidHaptic,
  soft: softHaptic,
  trigger: triggerHaptic,
};
