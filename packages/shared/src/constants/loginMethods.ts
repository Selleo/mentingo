export const OAUTH_LOGIN_METHODS = {
  GOOGLE: "google",
  MICROSOFT: "microsoft",
  SLACK: "slack",
} as const;

export const EMAIL_LOGIN_METHODS = {
  MAGIC_LINK: "magicLink",
  PASSWORD: "password",
} as const;

export const LOGIN_METHODS = {
  ...OAUTH_LOGIN_METHODS,
  ...EMAIL_LOGIN_METHODS,
} as const;

export const LOGIN_METHOD_ERROR_KEYS = {
  DISABLED: "loginMethods.errors.disabled",
  MISSING_CONFIGURATION: "loginMethods.errors.missingConfiguration",
  LAST_METHOD: "loginMethods.errors.lastMethod",
} as const;

export type OAuthLoginMethod = (typeof OAUTH_LOGIN_METHODS)[keyof typeof OAUTH_LOGIN_METHODS];
export type EmailLoginMethod = (typeof EMAIL_LOGIN_METHODS)[keyof typeof EMAIL_LOGIN_METHODS];
export type LoginMethod = (typeof LOGIN_METHODS)[keyof typeof LOGIN_METHODS];
