// Root Navigator - Switches between Auth and Main stacks
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { initDatabase } from '../database';
import BiometricLockScreen from '../screens/security/BiometricLockScreen';
import SplashScreen from '../screens/SplashScreen';
import IntroScreen from '../screens/IntroScreen';
import { View, Text, StyleSheet, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import {
  initializeNotificationChannels,
  requestNotificationPermission,
} from '../services/notifications/notificationService';
import {
  runAllBackgroundTasks,
  runMissedTasks,
  schedulePeriodicTaskRunner,
  stopPeriodicTaskRunner,
} from '../services/backgroundTasks';
import { scheduleDailyNudge, schedulePeriodicNudges } from '../services/notifications/scheduleNudges';
import { useTheme } from '../contexts/ThemeContext';
import { useThemeColors } from '../hooks/useThemeColors';

const Stack = createStackNavigator<RootStackParamList>();

// Deep linking configuration
const linking = {
  prefixes: ['wallet://'],
  config: {
    screens: {
      Main: {
        screens: {
          AddTransaction: {
            path: 'add-transaction',
            parse: {
              type: (type: string) => type as 'income' | 'expense',
            },
          },
        },
      },
      Auth: {
        screens: {
          Login: 'login',
          Signup: 'signup',
        },
      },
    },
  },
};

export function RootNavigator() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsBiometricAuth, setNeedsBiometricAuth] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasSeenIntro = useSettingsStore((state) => state.hasSeenIntro);
  const securitySettings = useSettingsStore((state) => state.securitySettings);
  const updateSecuritySettings = useSettingsStore((state) => state.updateSecuritySettings);
  const taskRunnerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

  // Initialize database, notifications, and background tasks
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('[App] Initializing...');

        // 1. Initialize database
        await initDatabase();
        console.log('[App] Database initialized');

        // 2. Initialize notification channels (Android)
        await initializeNotificationChannels();
        console.log('[App] Notification channels initialized');

        // 3. Request notification permission
        await requestNotificationPermission();

        // 4. Run missed tasks check (catch up on missed salary, subscriptions, etc.)
        await runMissedTasks();

        // 5. Schedule daily nudge and periodic nudges
        await scheduleDailyNudge();
        await schedulePeriodicNudges();

        // 6. Start periodic task runner (runs every hour while app is active)
        taskRunnerIntervalRef.current = schedulePeriodicTaskRunner(60);

      } catch (error) {
        console.error('[App] Initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      if (taskRunnerIntervalRef.current) {
        stopPeriodicTaskRunner(taskRunnerIntervalRef.current);
      }
    };
  }, []);

  // Check if biometric auth needed after initialization
  useEffect(() => {
    if (!isInitializing && isAuthenticated && securitySettings.isEnabled && !needsBiometricAuth) {
      // Check if need to re-authenticate based on timeout
      const now = Date.now();
      const lastAuth = securitySettings.lastAuthTime || 0;
      const timeout = securitySettings.autoLockTimeout * 1000; // Convert to ms

      if (timeout === 0 || (now - lastAuth) > timeout) {
        setNeedsBiometricAuth(true);
      }
    }
  }, [isInitializing, isAuthenticated, securitySettings.isEnabled, securitySettings.autoLockTimeout]);

  // Listen to app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // App just came to foreground
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[App] App came to foreground - running background tasks');
        runAllBackgroundTasks();

        // Check if need biometric auth on foreground (only if not already showing)
        if (isAuthenticated && securitySettings.isEnabled && !needsBiometricAuth) {
          const now = Date.now();
          const lastAuth = securitySettings.lastAuthTime || 0;
          const timeout = securitySettings.autoLockTimeout * 1000;

          if (timeout === 0 || (now - lastAuth) > timeout) {
            setNeedsBiometricAuth(true);
          }
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, securitySettings.isEnabled, securitySettings.lastAuthTime, securitySettings.autoLockTimeout, needsBiometricAuth]);

  // Handle successful biometric authentication
  const handleBiometricAuthenticated = () => {
    // BiometricLockScreen already updates lastAuthTime, so just clear the flag
    setNeedsBiometricAuth(false);
  };

  if (isInitializing) {
    return <SplashScreen />;
  }

  // Show intro video for first-time users
  if (!hasSeenIntro) {
    return <IntroScreen />;
  }

  // Show biometric lock if authenticated but not yet verified
  if (isAuthenticated && needsBiometricAuth) {
    return <BiometricLockScreen onAuthenticated={handleBiometricAuthenticated} />;
  }

  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: themeColors.primary,
      background: themeColors.background,
      card: themeColors.surface,
      text: themeColors.text,
      border: themeColors.border,
      notification: themeColors.accent,
    },
    fonts: DefaultTheme.fonts,
  };

  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
