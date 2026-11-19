import { Input } from "~/components/ui/input";
import { formatPrice, type CurrencyCode } from "~/lib/formatters/priceFormatter";

import { PRICE_INPUT_HANDLES } from "../../../e2e/data/common/handles";

import type { ChangeEvent, InputHTMLAttributes, FocusEvent } from "react";

type PriceInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value?: number;
  onChange: (value: number) => void;
  currency?: CurrencyCode;
  max?: number;
  locale?: string;
};

/**
 * Input component for handling price entries with automatic formatting
 * @component
 * @param {Object} props - Component props
 * @param {number} [props.value] - Value in minor units (e.g., cents)
 * @param {(value: number) => void} props.onChange - Callback triggered on value change, returns value in minor units
 * @param {CurrencyCode} [props.currency] - Currency code (e.g., 'USD', 'EUR')
 * @param {number} [props.max=999999.99] - Maximum allowed value in major units
 * @param {string} [props.locale] - Locale for number formatting
 *
 * @example
 * <PriceInput
 *   value={1000} // $10.00
 *   onChange={(value) => console.log(value)}
 *   currency="USD"
 *   locale="en-US"
 * />
 */
export const PriceInput = ({
  value,
  onChange,
  onBlur,
  currency = "USD",
  locale = "en-US",
  max = 999999.99,
  className,
  ...props
}: PriceInputProps) => {
  /**
   * Formats the input text by normalizing decimal separators and cleaning input
   * @param {string} value - Raw input value
   * @returns {string} Normalized price string with proper decimal formatting
   *
   * @example
   * normalizePrice("1,000.23") // "1000.23"
   * normalizePrice("1.000,23") // "1000.23"
   * normalizePrice("1000.234") // "1000.23"
   */
  const normalizePrice = (value: string) => {
    const normalized = value.replace(/[.,]/g, (match, index, string) => {
      return index === string.lastIndexOf(match) ? "." : "";
    });

    const cleaned = normalized.replace(/[^\d.]/g, "");
    const [whole, decimal] = cleaned.split(".");

    if (!decimal) return cleaned;
    return `${whole}.${decimal.slice(0, 2)}`;
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const normalizedValue = normalizePrice(event.target.value);
    const numericValue = parseFloat(normalizedValue);

    if (numericValue > max) {
      event.target.value = max.toFixed(2);
      onChange(max * 100);
      return;
    }

    event.target.value = normalizedValue;

    if (!normalizedValue) {
      onChange(0);
      return;
    }

    const priceInMinorUnits = Math.round(parseFloat(normalizedValue) * 100);
    if (!isNaN(priceInMinorUnits) && priceInMinorUnits >= 0) {
      onChange(priceInMinorUnits);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);

    const value = event.target.value;
    const numericValue = parseFloat(value);

    /*
     *  for values like 0, 0.00, 0.000, 00 etc. clear the input
     */
    if (numericValue === 0 || value.match(/^0[.,]?0*$/)) {
      event.target.value = "";
      onChange(0);
    }
  };

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        onChange={handleChange}
        onBlur={handleBlur}
        defaultValue={value ? formatPrice(value, currency, locale, { withCurrency: false }) : ""}
        className={className}
        {...props}
      />
      {currency && (
        <span
          className="absolute right-0 top-1/2 -translate-x-4 -translate-y-1/2 cursor-default uppercase"
          data-testid={PRICE_INPUT_HANDLES.CURRENCY}
        >
          {currency}
        </span>
      )}
    </div>
  );
};
