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
    return CURRENCIES.find((c) => c.code === code);
};

// Get currency symbol
export const getCurrencySymbol = (code: string): string => {
    const currency = getCurrencyByCode(code);
    return currency ? currency.symbol : code;
};

// Format amount with currency
export const formatCurrency = (
    amount: number,
    currencyCode: string,
    showCode: boolean = false
): string => {
    const symbol = getCurrencySymbol(currencyCode);
    const formattedAmount = amount.toLocaleString('en-US', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    });

    if (showCode) {
        return `${symbol}${formattedAmount} ${currencyCode}`;
    }

    return `${symbol}${formattedAmount}`;
};

// Search currencies by name or code
export const searchCurrencies = (query: string): Currency[] => {
    const lowerQuery = query.toLowerCase();
    return CURRENCIES.filter(
        (c) =>
            c.code.toLowerCase().includes(lowerQuery) ||
            c.name.toLowerCase().includes(lowerQuery)
    );
};
