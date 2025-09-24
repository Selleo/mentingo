import { match } from "ts-pattern";

/**
 * Get the locale for a given currency code.
 * @param currency - The currency code (e.g., "USD", "EUR").
 * @returns The locale string (e.g., "en-US", "de-DE").
 */
export const getCurrencyLocale = (currency: string) =>
  match(currency.toUpperCase())
    .with("USD", () => "en-US")
    .with("EUR", () => "de-DE")
    .with("PLN", () => "pl-PL")
    .otherwise(() => "en-US");
