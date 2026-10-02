/**
 * DialogStore — State management for the Simplizum Dialog & Prompt System
 */

import { create } from 'zustand';

export interface DialogButton {
  text: string;
  onPress?: (inputValue?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
  isPreferred?: boolean;
}

export interface DialogConfig {
  title: string;
  message?: string;
  type?: 'alert' | 'confirm' | 'prompt';
  superTag?: string;
  variant?: 'default' | 'destructive' | 'info' | 'success';
  buttons?: DialogButton[];
  cancelable?: boolean;
  onDismiss?: () => void;
  promptPlaceholder?: string;
  promptDefaultValue?: string;
  promptSecureTextEntry?: boolean;
  promptKeyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'decimal-pad';
  promptAutoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

interface DialogState {
  isOpen: boolean;
  config: DialogConfig | null;
  promptValue: string;
  setPromptValue: (val: string) => void;
  showDialog: (config: DialogConfig) => void;
  closeDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  isOpen: false,
  config: null,
  promptValue: '',
  setPromptValue: (val: string) => set({ promptValue: val }),
  showDialog: (config: DialogConfig) =>
    set({
      isOpen: true,
      config,
      promptValue: config.promptDefaultValue || '',
    }),
  closeDialog: () =>
    set((state) => {
      state.config?.onDismiss?.();
      return { isOpen: false, config: null, promptValue: '' };
    }),
}));
