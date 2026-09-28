import { parsePhoneNumberFromString } from "libphonenumber-js";

import { PHONE_AUTH_ALLOWED_COUNTRIES, PHONE_AUTH_DEFAULT_REGIONS } from "./phone-auth.constants";

import type { CountryCode, PhoneNumber } from "libphonenumber-js";

const MAX_RAW_PHONE_LENGTH = 32;

const isAllowedNumber = (
  phoneNumber: PhoneNumber | undefined,
  allowedCountries: readonly CountryCode[],
): phoneNumber is PhoneNumber =>
  Boolean(
    phoneNumber?.isValid() && phoneNumber.country && allowedCountries.includes(phoneNumber.country),
  );

/**
 * Normalizes user input to E.164 (e.g. "+79161234567").
 * Returns null when the number is invalid or belongs to a country outside the allow-list.
 *
 * Numbers without an international prefix are tried against the default regions in order,
 * so "8 916 123-45-67" and "9161234567" resolve to Russia and "99112233" to Mongolia.
 */
export const normalizePhone = (
  rawPhone: string | null | undefined,
  allowedCountries: readonly CountryCode[] = PHONE_AUTH_ALLOWED_COUNTRIES,
  defaultRegions: readonly CountryCode[] = PHONE_AUTH_DEFAULT_REGIONS,
): string | null => {
  if (typeof rawPhone !== "string") return null;

  const trimmed = rawPhone.trim();

  if (!trimmed || trimmed.length > MAX_RAW_PHONE_LENGTH) return null;
  if (!/^[+\d\s()\-.]+$/.test(trimmed)) return null;

  const international = trimmed.startsWith("+") || trimmed.startsWith("00");

  if (international) {
    const candidate = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
    const parsed = parsePhoneNumberFromString(candidate);

    return isAllowedNumber(parsed, allowedCountries) ? parsed.number : null;
  }

  for (const region of defaultRegions) {
    const parsed = parsePhoneNumberFromString(trimmed, region);

    if (isAllowedNumber(parsed, allowedCountries)) return parsed.number;
  }

  return null;
};

/**
 * Masks a phone number for logs: "+79161234567" -> "+7******4567".
 * Keeps the calling code (when parseable) and the last 4 digits only.
 */
export const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return "<empty>";

  const digits = phone.replace(/\D/g, "");

  if (digits.length <= 4) return "*".repeat(digits.length);

  const parsed = parsePhoneNumberFromString(phone.startsWith("+") ? phone : `+${digits}`);
  const callingCode = parsed?.countryCallingCode ?? "";
  const lastFour = digits.slice(-4);
  const hiddenLength = Math.max(0, digits.length - callingCode.length - lastFour.length);

  return `+${callingCode}${"*".repeat(hiddenLength)}${lastFour}`;
};

export const toSmsRuRecipient = (phone: string) => phone.replace(/\D/g, "");
