/**
 * @format
 */

// Polyfill for crypto.getRandomValues() - MUST be imported before uuid
import 'react-native-get-random-values';
import { enableScreens } from 'react-native-screens';

// Optimize memory and transition performance with native fragment backing
enableScreens(true);

import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Handle background notification events when the app is closed or in background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;
  if (type === EventType.PRESS) {
    console.log('[Notifee Background] User pressed notification:', notification?.id);
  } else if (type === EventType.DISMISSED) {
    console.log('[Notifee Background] User dismissed notification:', notification?.id);
  }
});

AppRegistry.registerComponent(appName, () => App);
