// Currency constants and helpers

export interface Currency {
    code: string;
    name: string;
    symbol: string;
    flag: string; // Emoji flag
}

// Popular currencies with their symbols and flags
export const CURRENCIES: Currency[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
    { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
    { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', flag: '🇯🇴' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
    { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', flag: '🇪🇬' },
    { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', flag: '🇰🇼' },
    { code: 'BHD', name: 'Bahraini Dinar', symbol: 'د.ب', flag: '🇧🇭' },
    { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', flag: '🇴🇲' },
    { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', flag: '🇶🇦' },
    { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', flag: '🇮🇱' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰' },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$', flag: '🇲🇽' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
    { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', flag: '🇵🇰' },
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', flag: '🇧🇩' },
    { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', flag: '🇱🇰' },
    { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', flag: '🇳🇵' },
];

// Get currency by code
export const getCurrencyByCode = (code: string): Currency | undefined => {
    if (!code) return undefined;
    const upper = code.trim().toUpperCase();
    return CURRENCIES.find((c) => c.code === upper);
};

// Get currency display label — always the 3-letter ISO code
export const getCurrencySymbol = (code: string): string => {
    return (code || 'USD').trim().toUpperCase();
};

// Format amount with currency — always uses 3-letter ISO code prefix
export const formatCurrency = (
    amount: number,
    currencyCode: string,
    _showCode: boolean = false
): string => {
    const code = (currencyCode || 'USD').trim().toUpperCase();
    const isNegative = amount < 0;
    const absFormatted = Math.abs(amount).toLocaleString('en-US', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    });
    const sign = isNegative ? '-' : '';

    // _showCode is ignored: the ISO code is always shown (kept for call-site compatibility)
    return `${sign}${code} ${absFormatted}`;
};

// Search currencies by name, code, symbol, or aliases
export const searchCurrencies = (query: string): Currency[] => {
    if (!query || !query.trim()) return CURRENCIES;
    const lower = query.trim().toLowerCase();
    return CURRENCIES.filter(
        (c) =>
            c.code.toLowerCase().includes(lower) ||
            c.name.toLowerCase().includes(lower) ||
            c.symbol.toLowerCase().includes(lower) ||
            (c.code === 'JOD' && (lower === 'jd' || lower === 'jordan' || lower === 'dinar')) ||
            (c.code === 'ILS' && (lower === 'nis' || lower === 'shekel')) ||
            (c.code === 'AED' && (lower === 'dhs' || lower === 'dirham')) ||
            (c.code === 'SAR' && (lower === 'sr' || lower === 'riyal')) ||
            (c.code === 'KWD' && (lower === 'kd' || lower === 'kuwait')) ||
            (c.code === 'EGP' && (lower === 'le' || lower === 'egypt')) ||
            (c.code === 'GBP' && (lower === 'pound' || lower === 'quid')) ||
            (c.code === 'JPY' && lower === 'yen') ||
            (c.code === 'EUR' && lower === 'euro') ||
            (c.code === 'USD' && (lower === 'dollar' || lower === 'buck'))
    );
};
