/**
 * Supported currency codes.
 */
export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "KRW" | "BHD" | "PLN" | string;

/**
 * Formats a price in minor units to a localized string representation.
 * @param amount - The price amount in minor units (e.g., cents).
 * @optional currency - The currency code (e.g., 'USD', 'EUR', 'JPY'). Case-insensitive. Default is 'USD'.
 * @param locale - The locale to use for formatting.
 * @param options - Additional formatting options
 * @param options.withCurrency - Whether to include the currency symbol. Default is true.
 * @returns The formatted price string.
 */
export function formatPrice(
  amount: number,
  currency: CurrencyCode = "USD",
  locale: string = "en-US",
  options: { withCurrency?: boolean } = { withCurrency: true },
): string {
  const upperCaseCurrency = currency.toUpperCase() as CurrencyCode;
  const majorUnits = convertToMajorUnits(amount, upperCaseCurrency);

  const formatter = new Intl.NumberFormat(locale, {
    style: options.withCurrency ? "currency" : "decimal",
    currency: upperCaseCurrency,
    minimumFractionDigits: getMinimumFractionDigits(upperCaseCurrency),
    maximumFractionDigits: getMaximumFractionDigits(upperCaseCurrency),
  });

  return formatter.format(majorUnits);
}

/**
 * Converts minor units to major units based on the currency.
 * @param amount - The amount in minor units.
 * @param currency - The currency code (uppercase).
 * @returns The amount in major units.
 */
function convertToMajorUnits(amount: number, currency: CurrencyCode): number {
  const conversionRates: Record<CurrencyCode, number> = {
    USD: 100,
    EUR: 100,
    GBP: 100,
    JPY: 1,
    KRW: 1,
    BHD: 1000,
  };

  const rate = conversionRates[currency] || 100;
  return amount / rate;
}

/**
 * Determines the minimum number of fraction digits for a given currency.
 * @param currency - The currency code (uppercase).
 * @returns The minimum number of fraction digits.
 */
function getMinimumFractionDigits(currency: CurrencyCode): number {
  const noFractionCurrencies: CurrencyCode[] = ["JPY", "KRW", "VND", "PLN"];
  return noFractionCurrencies.includes(currency) ? 0 : 2;
}

/**
 * Determines the maximum number of fraction digits for a given currency.
 * @param currency - The currency code (uppercase).
 * @returns The maximum number of fraction digits.
 */
function getMaximumFractionDigits(currency: CurrencyCode): number {
  const noFractionCurrencies: CurrencyCode[] = ["JPY", "KRW", "VND"];
  const threeFractionCurrencies: CurrencyCode[] = ["BHD", "IQD", "JOD", "KWD", "OMR", "TND"];

  if (noFractionCurrencies.includes(currency)) return 0;
  if (threeFractionCurrencies.includes(currency)) return 3;
  return 2; // Default for most currencies
}
