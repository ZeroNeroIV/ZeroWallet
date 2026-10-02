/**
 * Purpose: Provides theme context for light/dark mode support
 * 
 * Inputs:
 *   - children (ReactNode): Child components to wrap with theme provider
 * 
 * Outputs:
 *   - Returns (JSX.Element): Theme provider component
 * 
 * Side effects:
 *   - Listens to system color scheme changes
 *   - Updates theme based on settings store
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeFamily = 'swiss' | 'nordic' | 'cyber';

interface ThemeContextType {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  themeFamily: ThemeFamily;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeFamily: (family: ThemeFamily) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const { appSettings, updateAppSettings } = useSettingsStore();
  
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    if (appSettings.theme === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return appSettings.theme;
  });

  const currentFamily: ThemeFamily = appSettings.themeFamily || 'swiss';

  useEffect(() => {
    if (appSettings.theme === 'system') {
      setCurrentTheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    } else {
      setCurrentTheme(appSettings.theme);
    }
  }, [appSettings.theme, systemColorScheme]);

  const setThemeMode = (mode: ThemeMode) => {
    updateAppSettings({ theme: mode });
  };

  const setThemeFamily = (family: ThemeFamily) => {
    updateAppSettings({ themeFamily: family });
  };

  const value: ThemeContextType = {
    theme: currentTheme,
    themeMode: appSettings.theme,
    themeFamily: currentFamily,
    setThemeMode,
    setThemeFamily,
    isDark: currentTheme === 'dark',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
