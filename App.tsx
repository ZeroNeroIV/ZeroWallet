/**
 * Wallet - Money Tracking App
 * @format
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { useThemeColors } from './src/hooks/useThemeColors';
import { SimplizumDialog } from './src/components/common/SimplizumDialog';
import { dialogService } from './src/services/dialogService';

// Initialize global Alert.alert override with bespoke Simplizum Dialog UI
dialogService.initialize();

function AppContent() {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
        translucent={false}
      />
      <RootNavigator />
      <SimplizumDialog />
    </GestureHandlerRootView>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
