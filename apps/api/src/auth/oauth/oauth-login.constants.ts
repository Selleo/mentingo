export const OAUTH_LOGIN_ERROR_KEYS = {
  CANCELLED: "loginView.oauthError.cancelled",
  PROVIDER_DISABLED: "loginView.oauthError.providerDisabled",
  PROVIDER_NOT_CONFIGURED: "loginView.oauthError.providerNotConfigured",
  PROVIDER_ERROR: "loginView.oauthError.providerError",
  UNKNOWN: "loginView.oauthError.unknown",
} as const;

export type OAuthLoginErrorKey =
  (typeof OAUTH_LOGIN_ERROR_KEYS)[keyof typeof OAUTH_LOGIN_ERROR_KEYS];

export const OAUTH_PROVIDER_DENIED_ERROR = "access_denied";
