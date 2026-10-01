// Currency Exchange Service
// Fetches and caches exchange rates from MoneyConvert API

import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'currency-cache' });

const API_URL = 'https://cdn.moneyconvert.net/api/latest.json';
const CACHE_KEY = 'exchange_rates';
const CACHE_TIMESTAMP_KEY = 'exchange_rates_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (as per API terms)

export interface ExchangeRates {
    base: string; // Always 'USD'
    rates: { [currencyCode: string]: number };
    timestamp: number;
}

/**
 * Fetch fresh exchange rates from API
 */
const fetchExchangeRates = async (): Promise<ExchangeRates> => {
    try {
        console.log('[CurrencyService] Fetching exchange rates from API...');
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`API responded with status ${response.status}`);
        }

        const data = await response.json();
        console.log('[CurrencyService] Received rates for', Object.keys(data.rates).length, 'currencies');

        return {
            base: data.base,
            rates: data.rates,
            timestamp: Date.now(),
        };
    } catch (error) {
        console.error('[CurrencyService] Failed to fetch exchange rates:', error);
        throw error;
    }
};

// Bundled fallback exchange rates relative to USD (base: USD)
// Used when device is offline on launch and no cached rates exist
export const FALLBACK_EXCHANGE_RATES: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 155.0,
    JOD: 0.709,
    SAR: 3.75,
    AED: 3.67,
    EGP: 48.5,
    KWD: 0.307,
    BHD: 0.376,
    OMR: 0.385,
    QAR: 3.64,
    ILS: 3.70,
    TRY: 32.5,
    CNY: 7.23,
    INR: 83.5,
    AUD: 1.52,
    CAD: 1.36,
    CHF: 0.89,
    SEK: 10.5,
    NOK: 10.6,
    DKK: 6.87,
    PLN: 3.95,
    RUB: 91.0,
    ZAR: 18.2,
    BRL: 5.15,
    MXN: 16.8,
    SGD: 1.35,
    HKD: 7.82,
    KRW: 1370.0,
    MYR: 4.72,
    THB: 36.5,
    IDR: 16100.0,
    PHP: 57.5,
    VND: 25400.0,
    PKR: 278.0,
    BDT: 117.0,
    LKR: 300.0,
    NPR: 133.0,
};

/**
 * Get exchange rates (from cache or fresh from API)
 */
export const getExchangeRates = async (
    forceRefresh: boolean = false
): Promise<ExchangeRates> => {
    // Check cache first
    const cachedData = storage.getString(CACHE_KEY);
    const cachedTimestamp = storage.getNumber(CACHE_TIMESTAMP_KEY);

    if (!forceRefresh && cachedData && cachedTimestamp) {
        const age = Date.now() - cachedTimestamp;

        // Use cache if less than 5 minutes old
        if (age < CACHE_DURATION) {
            console.log('[CurrencyService] Using cached rates (age:', Math.round(age / 1000), 'seconds)');
            const parsedData = JSON.parse(cachedData);
            return {
                ...parsedData,
                timestamp: cachedTimestamp,
            };
        }
    }

    // Fetch fresh rates
    try {
        const freshRates = await fetchExchangeRates();

        // Cache the new rates
        storage.set(CACHE_KEY, JSON.stringify(freshRates));
        storage.set(CACHE_TIMESTAMP_KEY, freshRates.timestamp);

        return freshRates;
    } catch (error) {
        // If fetch fails but we have stale cache, use it
        if (cachedData && cachedTimestamp) {
            console.warn('[CurrencyService] Using stale cached rates due to fetch failure');
            const parsedData = JSON.parse(cachedData);
            return {
                ...parsedData,
                timestamp: cachedTimestamp,
            };
        }

        // Use fallback bundled rates if offline and no cache
        console.warn('[CurrencyService] Using fallback bundled rates (offline / API unavailable)');
        return {
            base: 'USD',
            rates: FALLBACK_EXCHANGE_RATES,
            timestamp: Date.now(),
        };
    }
};

/**
 * Convert amount from one currency to another
 */
export const convertCurrency = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string
): Promise<{
    convertedAmount: number;
    exchangeRate: number;
    timestamp: number;
}> => {
    const fromCode = (fromCurrency || 'USD').trim().toUpperCase();
    const toCode = (toCurrency || 'USD').trim().toUpperCase();

    // If same currency, no conversion needed
    if (fromCode === toCode) {
        return {
            convertedAmount: Math.round(amount * 1000) / 1000,
            exchangeRate: 1,
            timestamp: Date.now(),
        };
    }

    const rates = await getExchangeRates();

    // Get rates for both currencies (all rates are relative to USD)
    const fromRate = fromCode === 'USD' ? 1 : (rates.rates[fromCode] ?? FALLBACK_EXCHANGE_RATES[fromCode]);
    const toRate = toCode === 'USD' ? 1 : (rates.rates[toCode] ?? FALLBACK_EXCHANGE_RATES[toCode]);

    if (!fromRate || !toRate) {
        throw new Error(`Exchange rate not available for ${fromCurrency} or ${toCurrency}`);
    }

    // Convert: amount in fromCurrency -> USD -> toCurrency
    const amountInUSD = fromCode === 'USD' ? amount : amount / fromRate;
    const convertedAmount = toCode === 'USD' ? amountInUSD : amountInUSD * toRate;

    // Calculate the direct exchange rate from fromCurrency to toCurrency
    const exchangeRate = toRate / fromRate;

    console.log(
        `[CurrencyService] Converted ${amount} ${fromCode} to ${convertedAmount.toFixed(3)} ${toCode} (rate: ${exchangeRate.toFixed(4)})`
    );

    return {
        convertedAmount: Math.round(convertedAmount * 1000) / 1000, // Round to 3 decimals
        exchangeRate,
        timestamp: rates.timestamp,
    };
};

/**
 * Get cached timestamp (for checking staleness)
 */
export const getCachedTimestamp = (): number | undefined => {
    return storage.getNumber(CACHE_TIMESTAMP_KEY);
};

/**
 * Check if cached rates are stale (older than 24 hours)
 */
export const areCachedRatesStale = (): boolean => {
    const timestamp = getCachedTimestamp();
    if (!timestamp) return true;

    const age = Date.now() - timestamp;
    return age > 24 * 60 * 60 * 1000; // 24 hours
};

/**
 * Clear cache (useful for testing)
 */
export const clearCache = (): void => {
    storage.remove(CACHE_KEY);
    storage.remove(CACHE_TIMESTAMP_KEY);
    console.log('[CurrencyService] Cache cleared');
};

/**
 * Get live exchange rate between two currencies
 */
export const getExchangeRate = async (
    fromCurrency: string,
    toCurrency: string
): Promise<number> => {
    const fromCode = (fromCurrency || 'USD').trim().toUpperCase();
    const toCode = (toCurrency || 'USD').trim().toUpperCase();

    if (fromCode === toCode) return 1;

    const rates = await getExchangeRates();
    const fromRate = fromCode === 'USD' ? 1 : (rates.rates[fromCode] ?? FALLBACK_EXCHANGE_RATES[fromCode]);
    const toRate = toCode === 'USD' ? 1 : (rates.rates[toCode] ?? FALLBACK_EXCHANGE_RATES[toCode]);

    if (!fromRate || !toRate) {
        throw new Error(`Exchange rate not available for ${fromCurrency} or ${toCurrency}`);
    }

    return toRate / fromRate;
};
