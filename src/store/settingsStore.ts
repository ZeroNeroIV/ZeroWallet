// Settings Store - Manages app settings (MMKV persisted)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mmkvStorage } from './middleware/mmkvStorage';
import type { SettingsState } from '../types/store';
import type { AISettings } from '../types/ai';

// ============================================
// Default Settings
// ============================================

const defaultSalarySettings = {
  isEnabled: false,
  amount: 0,
  categoryId: '',
  targetVault: 'main' as const,
  payDay: 1,
  lastProcessed: null,
  nextProcessing: getNextFirstOfMonth(),
};

const defaultNotificationSettings = {
  nudgeTime: '20:00',
  dailyNudgeEnabled: true,
  periodicNudgesEnabled: false,
  lowBalanceAlertEnabled: true,
  lowBalanceThreshold: 50,
  subscriptionRemindersEnabled: true,
  subscriptionDaysBefore: 2,
  recurringRemindersEnabled: true,
  recurringDaysBefore: 2,
  salaryReminderEnabled: true,
};

const defaultAppSettings = {
  theme: 'system' as const,
  hapticFeedback: true,
  currency: 'USD',
};

const defaultSecuritySettings = {
  isEnabled: false,
  authType: 'none' as const,
  biometricEnabled: false,
  pinHash: null,
  autoLockTimeout: 0, // 0 = immediate re-auth
  lastAuthTime: null,
  failedAttempts: 0,
  maxFailedAttempts: 5,
  lockoutUntil: null,
};

const defaultAISettings: AISettings = {
  apiKey: null,
  selectedModel: 'gemini-2.5-flash', // Recommended model
  isConfigured: false,
  totalTokensUsed: 0,
  conversationCount: 0,
  lastUsed: null,
};

// ============================================
// Helper Functions
// ============================================

function getNextFirstOfMonth(): number {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.getTime();
}

// ============================================
// Settings Store
// ============================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // State
      salarySettings: defaultSalarySettings,
      notificationSettings: defaultNotificationSettings,
      appSettings: defaultAppSettings,
      securitySettings: defaultSecuritySettings,
      aiSettings: defaultAISettings,
      hasSeenIntro: false,

      // Actions
      markIntroSeen: () => set({ hasSeenIntro: true }),

      updateSalarySettings: (settings) => {
        set((state) => ({
          salarySettings: {
            ...state.salarySettings,
            ...settings,
          },
        }));

        console.log('[SettingsStore] Salary settings updated:', settings);
      },

      updateNotificationSettings: (settings) => {
        set((state) => ({
          notificationSettings: {
            ...state.notificationSettings,
            ...settings,
          },
        }));

        console.log('[SettingsStore] Notification settings updated:', settings);
      },

      updateAppSettings: (settings) => {
        set((state) => ({
          appSettings: {
            ...state.appSettings,
            ...settings,
          },
        }));

        console.log('[SettingsStore] App settings updated:', settings);
      },

      updateSecuritySettings: (settings) => {
        set((state) => ({
          securitySettings: {
            ...state.securitySettings,
            ...settings,
          },
        }));

        console.log('[SettingsStore] Security settings updated:', settings);
      },

      updateAISettings: (settings) => {
        set((state) => ({
          aiSettings: {
            ...state.aiSettings,
            ...settings,
            // Auto-update isConfigured when apiKey changes
            isConfigured: settings.apiKey !== undefined
              ? settings.apiKey !== null && settings.apiKey.length > 0
              : state.aiSettings.isConfigured,
          },
        }));

        console.log('[SettingsStore] AI settings updated:', settings);
      },

      resetSettings: () => {
        set({
          salarySettings: defaultSalarySettings,
          notificationSettings: defaultNotificationSettings,
          appSettings: defaultAppSettings,
          securitySettings: defaultSecuritySettings,
          aiSettings: defaultAISettings,
        });

        console.log('[SettingsStore] All settings reset to defaults');
      },
    }),
    {
      name: 'settings-storage',
      storage: mmkvStorage,
      version: 2,
      migrate: (persistedState: any, version: number) => {
        // Migrate old model names to new ones
        if (persistedState?.aiSettings?.selectedModel) {
          const oldModel = persistedState.aiSettings.selectedModel;
          const modelMigration: Record<string, string> = {
            'gemini-2.0-flash-lite': 'gemini-1.5-flash',
            'gemini-2.0-flash': 'gemini-2.5-flash',
            'gemini-2.0-pro': 'gemini-1.5-pro',
          };

          if (modelMigration[oldModel]) {
            console.log(`[SettingsStore] Migrating model: ${oldModel} → ${modelMigration[oldModel]}`);
            persistedState.aiSettings.selectedModel = modelMigration[oldModel];
          }
        }

        // v2: salary payday + merged smart-nudge settings
        if (version < 2) {
          if (persistedState?.salarySettings && persistedState.salarySettings.payDay === undefined) {
            persistedState.salarySettings.payDay = 1;
          }
          const n = persistedState?.notificationSettings;
          if (n) {
            persistedState.notificationSettings = {
              nudgeTime: n.nudgeTime ?? '20:00',
              dailyNudgeEnabled: n.dailyNudgeEnabled ?? n.nudgesEnabled ?? true,
              periodicNudgesEnabled: n.periodicNudgesEnabled ?? false,
              lowBalanceAlertEnabled: n.lowBalanceAlertEnabled ?? true,
              lowBalanceThreshold: n.lowBalanceThreshold ?? 50,
              subscriptionRemindersEnabled:
                n.subscriptionRemindersEnabled ?? n.subscriptionReminders ?? true,
              subscriptionDaysBefore: n.subscriptionDaysBefore ?? 2,
              recurringRemindersEnabled:
                n.recurringRemindersEnabled ?? n.recurringReminders ?? true,
              recurringDaysBefore: n.recurringDaysBefore ?? 2,
              salaryReminderEnabled: n.salaryReminderEnabled ?? true,
            };
          }
        }

        return persistedState;
      },
    }
  )
);
