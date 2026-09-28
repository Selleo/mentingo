import type { CountryCode } from "libphonenumber-js";

export const PHONE_OTP_CODE_LENGTH = 6;
export const PHONE_OTP_TTL_SECONDS = 5 * 60;
export const PHONE_OTP_MAX_ATTEMPTS = 5;
export const PHONE_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const PHONE_OTP_MAX_CODES_PER_WINDOW = 5;
export const PHONE_OTP_CODES_WINDOW_SECONDS = 60 * 60;

export const PHONE_OTP_REDIS_PREFIX = "phone-otp";

export const PHONE_OTP_PURPOSE = {
  LOGIN: "login",
  ATTACH: "attach",
} as const;

/**
 * Countries whose numbers are accepted for phone login. +7 is shared by Russia and Kazakhstan,
 * +976 is Mongolia.
 */
export const PHONE_AUTH_ALLOWED_COUNTRIES: readonly CountryCode[] = ["RU", "KZ", "MN"];

/**
 * Regions tried (in order) for numbers typed without an international prefix,
 * e.g. 8XXXXXXXXXX / 9XXXXXXXXX resolve to Russia, 8-digit local numbers to Mongolia.
 */
export const PHONE_AUTH_DEFAULT_REGIONS: readonly CountryCode[] = ["RU", "MN"];

export const SMS_PROVIDER = Symbol("SMS_PROVIDER");

export const SMSRU_SEND_URL = "https://sms.ru/sms/send";
export const SMSRU_REQUEST_TIMEOUT_MS = 10_000;
export const SMSRU_SUCCESS_STATUS_CODE = 100;

export const SMSRU_ERROR_DESCRIPTIONS: Record<number, string> = {
  102: "Invalid api_id",
  103: "Insufficient funds",
  104: "Invalid recipient number",
  105: "Invalid sender name",
  107: "Recipient number is not allowed",
  110: "Duplicate message",
  112: "Daily limit for this number reached",
  113: "Blocked by moderator",
  150: "SMS.RU system error",
};

export const PHONE_AUTH_ERRORS = {
  DISABLED: "phoneAuth.error.disabled",
  INVALID_PHONE: "phoneAuth.error.invalidPhone",
  INVALID_OR_EXPIRED_CODE: "phoneAuth.error.invalidOrExpiredCode",
  TOO_MANY_ATTEMPTS: "phoneAuth.error.tooManyAttempts",
  RESEND_COOLDOWN: "phoneAuth.error.resendCooldown",
  TOO_MANY_CODES: "phoneAuth.error.tooManyCodes",
  PHONE_TAKEN: "phoneAuth.error.phoneTaken",
  PHONE_ALREADY_VERIFIED: "phoneAuth.error.alreadyVerified",
  SMS_SEND_FAILED: "phoneAuth.error.smsSendFailed",
  SSO_ENFORCED: "phoneAuth.error.ssoEnforced",
} as const;

export const PHONE_AUTH_MESSAGES = {
  CODE_SENT: "phoneAuth.toast.codeSent",
  PHONE_VERIFIED: "phoneAuth.toast.phoneVerified",
  PHONE_REMOVED: "phoneAuth.toast.phoneRemoved",
} as const;
