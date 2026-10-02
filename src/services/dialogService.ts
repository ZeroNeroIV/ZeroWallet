/**
 * DialogService — Unified procedural service and global Alert.alert override
 *
 * Intercepts React Native's native Alert.alert globally, replacing the OS dialog
 * with the bespoke, razor-thin Simplizum Architectural Dialog across the entire app.
 */

import { Alert } from 'react-native';
import { useDialogStore, type DialogButton, type DialogConfig } from '../store/dialogStore';

class DialogService {
  private isInitialized = false;

  /**
   * Initializes the global interceptor, routing Alert.alert calls to the Simplizum UI
   */
  public initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Save native reference just in case
    (Alert as any)._nativeAlert = Alert.alert;

    // Monkey-patch Alert.alert with our custom dialog system
    Alert.alert = (
      title: string,
      message?: string,
      buttons?: any[],
      options?: { cancelable?: boolean; onDismiss?: () => void }
    ) => {
      this.alert(title, message, buttons, options);
    };
  }

  /**
   * Shows a standard dialog or alert
   */
  public alert(
    title: string,
    message?: string,
    buttons?: any[],
    options?: { cancelable?: boolean; onDismiss?: () => void }
  ) {
    const formattedButtons: DialogButton[] =
      buttons && buttons.length > 0
        ? buttons.map((b) => ({
            text: b.text || 'OK',
            onPress: b.onPress,
            style: b.style || 'default',
            isPreferred: b.isPreferred,
          }))
        : [{ text: 'OK', style: 'default' }];

    // Auto-detect superTag & variant
    let superTag = 'SYSTEM NOTICE';
    let variant: DialogConfig['variant'] = 'default';

    const lowerTitle = (title || '').toLowerCase();
    const hasDestructive = formattedButtons.some((b) => b.style === 'destructive');

    if (hasDestructive || lowerTitle.includes('delete') || lowerTitle.includes('wipe') || lowerTitle.includes('purge')) {
      superTag = 'CRITICAL SAFEGUARD';
      variant = 'destructive';
    } else if (lowerTitle.includes('lock') || lowerTitle.includes('security') || lowerTitle.includes('pin') || lowerTitle.includes('biometric')) {
      superTag = 'SECURITY ENCLAVE';
    } else if (lowerTitle.includes('confirm') || lowerTitle.includes('warning')) {
      superTag = 'CONFIRMATION REQUIRED';
    } else if (lowerTitle.includes('success') || lowerTitle.includes('complete')) {
      superTag = 'OPERATION COMPLETE';
      variant = 'success';
    }

    useDialogStore.getState().showDialog({
      title,
      message,
      type: formattedButtons.length > 1 ? 'confirm' : 'alert',
      superTag,
      variant,
      buttons: formattedButtons,
      cancelable: options?.cancelable ?? true,
      onDismiss: options?.onDismiss,
    });
  }

  /**
   * Shows a standard two-action confirmation dialog
   */
  public confirm(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
      superTag?: string;
    }
  ) {
    useDialogStore.getState().showDialog({
      title,
      message,
      type: 'confirm',
      superTag: options?.superTag || (options?.destructive ? 'CRITICAL CONFIRMATION' : 'CONFIRMATION REQUIRED'),
      variant: options?.destructive ? 'destructive' : 'default',
      buttons: [
        {
          text: options?.cancelText || 'Cancel',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: options?.confirmText || 'Confirm',
          style: options?.destructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ],
      cancelable: true,
      onDismiss: onCancel,
    });
  }

  /**
   * Shows an interactive text input prompt modal
   */
  public prompt(
    title: string,
    message: string,
    onConfirm: (val: string) => void,
    onCancel?: () => void,
    options?: {
      placeholder?: string;
      defaultValue?: string;
      confirmText?: string;
      cancelText?: string;
      secureTextEntry?: boolean;
      keyboardType?: DialogConfig['promptKeyboardType'];
      autoCapitalize?: DialogConfig['promptAutoCapitalize'];
      superTag?: string;
      destructive?: boolean;
    }
  ) {
    useDialogStore.getState().showDialog({
      title,
      message,
      type: 'prompt',
      superTag: options?.superTag || 'INPUT PROMPT',
      variant: options?.destructive ? 'destructive' : 'default',
      promptPlaceholder: options?.placeholder,
      promptDefaultValue: options?.defaultValue,
      promptSecureTextEntry: options?.secureTextEntry,
      promptKeyboardType: options?.keyboardType,
      promptAutoCapitalize: options?.autoCapitalize,
      buttons: [
        {
          text: options?.cancelText || 'Cancel',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: options?.confirmText || 'Submit',
          style: options?.destructive ? 'destructive' : 'default',
          onPress: (val?: string) => onConfirm(val || ''),
        },
      ],
      cancelable: true,
      onDismiss: onCancel,
    });
  }
}

export const dialogService = new DialogService();
