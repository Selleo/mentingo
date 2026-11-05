export const AUTH_TOKEN_PURPOSE = {
  ACCESS: "access",
  REFRESH: "refresh",
  MFA: "mfa",
} as const;

export type AuthTokenPurpose = (typeof AUTH_TOKEN_PURPOSE)[keyof typeof AUTH_TOKEN_PURPOSE];
export type AuthSessionTokenPurpose = Exclude<AuthTokenPurpose, typeof AUTH_TOKEN_PURPOSE.MFA>;

export const AUTH_SESSION_STATUS = {
  AUTHENTICATED: "authenticated",
  MFA_REQUIRED: "mfa_required",
} as const;

export type AuthSessionStatus = (typeof AUTH_SESSION_STATUS)[keyof typeof AUTH_SESSION_STATUS];

export const AUTH_ERROR_KEYS = {
  MFA_REQUIRED: "auth.error.mfaRequired",
  MFA_ALREADY_ENABLED: "auth.error.mfaAlreadyEnabled",
  MFA_CODE_ALREADY_USED: "auth.error.mfaCodeAlreadyUsed",
  INVALID_MFA_CODE: "auth.error.invalidMfaCode",
  SESSION_EXPIRED: "auth.error.sessionExpired",
  SESSION_REVOKED: "auth.error.sessionRevoked",
  INVALID_SETTINGS_UPDATE: "auth.error.invalidSettingsUpdate",
} as const;

export const SUPPORT_SESSION_ERROR_KEYS = {
  SESSION_EXPIRED: "supportMode.errors.sessionExpired",
} as const;

export const AUTH_SOCKET_EVENTS = {
  SESSION_EXPIRED: "auth:expired",
} as const;
