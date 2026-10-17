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

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  const themeSetting = useSettingsStore((s) => s.appSettings.theme);
  const themeFamilySetting = useSettingsStore((s) => s.appSettings.themeFamily);
  const updateAppSettings = useSettingsStore((s) => s.updateAppSettings);
  
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    if (themeSetting === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeSetting;
  });

  const currentFamily: ThemeFamily = themeFamilySetting || 'swiss';

  useEffect(() => {
    if (themeSetting === 'system') {
      setCurrentTheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    } else {
      setCurrentTheme(themeSetting);
    }
  }, [themeSetting, systemColorScheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    updateAppSettings({ theme: mode });
  }, [updateAppSettings]);

  const setThemeFamily = useCallback((family: ThemeFamily) => {
    updateAppSettings({ themeFamily: family });
  }, [updateAppSettings]);

  const value = useMemo<ThemeContextType>(() => ({
    theme: currentTheme,
    themeMode: themeSetting,
    themeFamily: currentFamily,
    setThemeMode,
    setThemeFamily,
    isDark: currentTheme === 'dark',
  }), [currentTheme, themeSetting, currentFamily, setThemeMode, setThemeFamily]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
