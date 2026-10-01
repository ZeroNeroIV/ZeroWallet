import { Platform } from 'react-native';
import { setMMKVItem, getMMKVItem } from '../store/middleware/mmkvStorage';
import { WidgetData } from '../types/models';
import { getCurrencySymbol as getCommonCurrencySymbol } from '../constants/currencies';

// MMKV key for widget data
const WIDGET_DATA_KEY = 'widget-data';

/**
 * Get currency symbol from currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
  return getCommonCurrencySymbol(currencyCode);
}

/**
 * Sync balance data to widget storage
 * This function writes balance data to MMKV for the Android widget to read
 */
export function syncWidgetData(
  accountId: string,
  balance: number,
  currency: string = 'USD'
): void {
  // Only sync on Android
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    const widgetData: WidgetData = {
      balance,
      accountId,
      currencySymbol: getCurrencySymbol(currency),
      lastUpdated: Date.now(),
    };

    setMMKVItem(WIDGET_DATA_KEY, widgetData);
    console.log('[WidgetDataManager] Synced widget data:', widgetData);
  } catch (error) {
    console.error('[WidgetDataManager] Failed to sync widget data:', error);
  }
}

/**
 * Get current widget data
 */
export function getWidgetData(): WidgetData | null {
  try {
    return getMMKVItem<WidgetData>(WIDGET_DATA_KEY, null as any);
  } catch (error) {
    console.error('[WidgetDataManager] Failed to get widget data:', error);
    return null;
  }
}

/**
 * Clear widget data (useful on logout)
 */
export function clearWidgetData(): void {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    const emptyData: WidgetData = {
      balance: 0,
      accountId: '',
      currencySymbol: '$',
      lastUpdated: Date.now(),
    };
    setMMKVItem(WIDGET_DATA_KEY, emptyData);
    console.log('[WidgetDataManager] Cleared widget data');
  } catch (error) {
    console.error('[WidgetDataManager] Failed to clear widget data:', error);
  }
}
