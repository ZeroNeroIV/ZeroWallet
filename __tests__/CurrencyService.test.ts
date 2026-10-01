import {
  convertCurrency,
  getExchangeRate,
  getExchangeRates,
  FALLBACK_EXCHANGE_RATES,
} from '../src/services/currencyService';
import {
  formatCurrency,
  getCurrencyByCode,
  getCurrencySymbol,
  searchCurrencies,
} from '../src/constants/currencies';

describe('CurrencyService & Currency Utilities', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('formatCurrency', () => {
    it('formats positive amounts with 3 decimals and correct symbol', () => {
      expect(formatCurrency(10.5, 'USD')).toBe('$10.500');
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.560');
      expect(formatCurrency(0, 'USD')).toBe('$0.000');
    });

    it('formats negative amounts with the minus sign before the symbol', () => {
      expect(formatCurrency(-10.5, 'USD')).toBe('-$10.500');
      expect(formatCurrency(-1234.56, 'EUR')).toBe('-€1,234.560');
    });

    it('handles lowercase and mixed-case currency codes', () => {
      expect(formatCurrency(50, 'usd')).toBe('$50.000');
      expect(formatCurrency(-50, 'eur')).toBe('-€50.000');
      expect(formatCurrency(100, 'Jod')).toBe('د.ا100.000');
    });

    it('falls back to currency code if currency is not recognized', () => {
      expect(formatCurrency(75, 'XYZ')).toBe('XYZ75.000');
      expect(formatCurrency(-75, 'XYZ')).toBe('-XYZ75.000');
    });

    it('supports showCode flag', () => {
      expect(formatCurrency(10.5, 'USD', true)).toBe('$10.500 USD');
      expect(formatCurrency(-10.5, 'EUR', true)).toBe('-€10.500 EUR');
    });
  });

  describe('getCurrencySymbol and getCurrencyByCode', () => {
    it('is case-insensitive', () => {
      expect(getCurrencySymbol('usd')).toBe('$');
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('eur')).toBe('€');
      expect(getCurrencySymbol('jod')).toBe('د.ا');
    });

    it('returns uppercase code if unknown', () => {
      expect(getCurrencySymbol('unknown')).toBe('UNKNOWN');
    });

    it('finds currency definition case-insensitively', () => {
      const usd = getCurrencyByCode('usd');
      expect(usd).toBeDefined();
      expect(usd?.code).toBe('USD');
      expect(usd?.name).toBe('US Dollar');

      const nonExistent = getCurrencyByCode('non-existent');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('searchCurrencies', () => {
    it('returns all currencies when query is empty or whitespace', () => {
      expect(searchCurrencies('').length).toBeGreaterThan(30);
      expect(searchCurrencies('   ').length).toBeGreaterThan(30);
    });

    it('matches JOD by code, name, and aliases (JD, dinar, jordan)', () => {
      const byCode = searchCurrencies('JOD');
      expect(byCode.some((c) => c.code === 'JOD')).toBe(true);

      const byCodeLower = searchCurrencies('jod');
      expect(byCodeLower.some((c) => c.code === 'JOD')).toBe(true);

      const byAliasJD = searchCurrencies('jd');
      expect(byAliasJD.some((c) => c.code === 'JOD')).toBe(true);

      const byCountry = searchCurrencies('jordan');
      expect(byCountry.some((c) => c.code === 'JOD')).toBe(true);

      const bySymbol = searchCurrencies('د.ا');
      expect(bySymbol.some((c) => c.code === 'JOD')).toBe(true);
    });

    it('matches other common currencies by code or alias', () => {
      expect(searchCurrencies('dollar').some((c) => c.code === 'USD')).toBe(true);
      expect(searchCurrencies('euro').some((c) => c.code === 'EUR')).toBe(true);
      expect(searchCurrencies('pound').some((c) => c.code === 'GBP')).toBe(true);
      expect(searchCurrencies('dirham').some((c) => c.code === 'AED')).toBe(true);
      expect(searchCurrencies('riyal').some((c) => c.code === 'SAR')).toBe(true);
    });

    it('returns empty array if no match is found', () => {
      expect(searchCurrencies('XYZNONEXISTENT')).toEqual([]);
    });
  });

  describe('Offline Fallback Rates', () => {
    it('falls back to bundled rates when API is offline and cache is empty', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const rates = await getExchangeRates(true);
      expect(rates.base).toBe('USD');
      expect(rates.rates.USD).toBe(1);
      expect(rates.rates.EUR).toBe(FALLBACK_EXCHANGE_RATES.EUR);
      expect(rates.rates.JOD).toBe(FALLBACK_EXCHANGE_RATES.JOD);
    });
  });

  describe('convertCurrency and getExchangeRate with Live/Mocked Rates', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          base: 'USD',
          rates: {
            USD: 1,
            EUR: 0.92,
            GBP: 0.8,
            JOD: 0.709,
            JPY: 150,
          },
        }),
      });
    });

    it('returns the same amount for same-currency conversions', async () => {
      const result = await convertCurrency(100, 'USD', 'USD');
      expect(result.convertedAmount).toBe(100);
      expect(result.exchangeRate).toBe(1);

      const resultEur = await convertCurrency(50.25, 'EUR', 'EUR');
      expect(resultEur.convertedAmount).toBe(50.25);
      expect(resultEur.exchangeRate).toBe(1);
    });

    it('returns exchange rate 1.0 for same currency', async () => {
      const rate = await getExchangeRate('EUR', 'EUR');
      expect(rate).toBe(1.0);
    });

    it('converts USD to foreign currency correctly', async () => {
      // 100 USD * 0.92 = 92 EUR
      const result = await convertCurrency(100, 'USD', 'EUR');
      expect(result.convertedAmount).toBe(92);
      expect(result.exchangeRate).toBe(0.92);

      const rate = await getExchangeRate('USD', 'EUR');
      expect(rate).toBe(0.92);
    });

    it('converts foreign currency to USD correctly without throwing USD error', async () => {
      // 92 EUR / 0.92 = 100 USD
      const result = await convertCurrency(92, 'EUR', 'USD');
      expect(result.convertedAmount).toBe(100);
      expect(result.exchangeRate).toBeCloseTo(1 / 0.92, 4);

      const rate = await getExchangeRate('EUR', 'USD');
      expect(rate).toBeCloseTo(1 / 0.92, 4);
    });

    it('converts between two non-USD currencies correctly with 3-decimal rounding', async () => {
      // 100 EUR -> USD: 100 / 0.92 = 108.69565...
      // USD -> JOD: 108.69565... * 0.709 = 77.0652...
      // Rounded to 3 decimals: 77.065
      const result = await convertCurrency(100, 'EUR', 'JOD');
      expect(result.convertedAmount).toBe(77.065);
      expect(result.exchangeRate).toBeCloseTo(0.709 / 0.92, 4);

      const rate = await getExchangeRate('EUR', 'JOD');
      expect(rate).toBeCloseTo(0.709 / 0.92, 4);
    });

    it('handles lowercase currency parameters seamlessly', async () => {
      const result = await convertCurrency(100, 'usd', 'eur');
      expect(result.convertedAmount).toBe(92);

      const rate = await getExchangeRate('eur', 'usd');
      expect(rate).toBeCloseTo(1 / 0.92, 4);
    });

    it('throws descriptive error if a currency is not supported', async () => {
      await expect(convertCurrency(100, 'USD', 'UNKNOWN')).rejects.toThrow(
        /Exchange rate not available for/i
      );
      await expect(getExchangeRate('INVALID', 'USD')).rejects.toThrow(
        /Exchange rate not available for/i
      );
    });
  });
});
