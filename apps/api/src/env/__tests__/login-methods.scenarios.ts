import { LOGIN_METHOD_ERROR_KEYS, LOGIN_METHODS } from "@repo/shared";

export const ADMIN_PASSWORD = "Password123@";

/** Every login flag and credential is stored explicitly so process env fallbacks never leak in. */
export const NO_OAUTH_PROVIDER_SECRETS = {
  GOOGLE_OAUTH_ENABLED: "false",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  MICROSOFT_OAUTH_ENABLED: "false",
  MICROSOFT_CLIENT_ID: "",
  MICROSOFT_CLIENT_SECRET: "",
  SLACK_OAUTH_ENABLED: "false",
  SLACK_CLIENT_ID: "",
  SLACK_CLIENT_SECRET: "",
} as const;

export const REJECTED_LOGIN_METHOD_UPDATES = [
  {
    title: "enabling Google without any credentials",
    storedSecrets: {},
    enforceSSO: false,
    update: { method: LOGIN_METHODS.GOOGLE, enabled: true },
    expectedError: LOGIN_METHOD_ERROR_KEYS.MISSING_CONFIGURATION,
  },
  {
    title: "enabling Microsoft without its client secret",
    storedSecrets: { MICROSOFT_CLIENT_ID: "microsoft-id" },
    enforceSSO: false,
    update: { method: LOGIN_METHODS.MICROSOFT, enabled: true },
    expectedError: LOGIN_METHOD_ERROR_KEYS.MISSING_CONFIGURATION,
  },
  {
    title: "enabling Slack with a blank client secret",
    storedSecrets: { SLACK_CLIENT_ID: "slack-id", SLACK_CLIENT_SECRET: "   " },
    enforceSSO: false,
    update: { method: LOGIN_METHODS.SLACK, enabled: true },
    expectedError: LOGIN_METHOD_ERROR_KEYS.MISSING_CONFIGURATION,
  },
  {
    title: "disabling password when magic link is already disabled",
    storedSecrets: { MAGIC_LINK_LOGIN_ENABLED: "false" },
    enforceSSO: false,
    update: { method: LOGIN_METHODS.PASSWORD, enabled: false },
    expectedError: LOGIN_METHOD_ERROR_KEYS.LAST_METHOD,
  },
  {
    title: "disabling password when the only other enabled method is an unconfigured provider",
    storedSecrets: { MAGIC_LINK_LOGIN_ENABLED: "false", GOOGLE_OAUTH_ENABLED: "true" },
    enforceSSO: false,
    update: { method: LOGIN_METHODS.PASSWORD, enabled: false },
    expectedError: LOGIN_METHOD_ERROR_KEYS.LAST_METHOD,
  },
  {
    title: "disabling magic link when SSO enforcement blocks password login",
    storedSecrets: {},
    enforceSSO: true,
    update: { method: LOGIN_METHODS.MAGIC_LINK, enabled: false },
    expectedError: LOGIN_METHOD_ERROR_KEYS.LAST_METHOD,
  },
] as const;

export const ACCEPTED_LOGIN_METHOD_UPDATES = [
  {
    title: "enabling Google with stored credentials",
    storedSecrets: { GOOGLE_CLIENT_ID: "google-id", GOOGLE_CLIENT_SECRET: "google-secret" },
    update: { method: LOGIN_METHODS.GOOGLE, enabled: true },
    expectedMethods: { google: true, password: true, magicLink: true },
    expectedPublicSSOFlags: { google: "true" },
  },
  {
    title: "disabling an enabled Microsoft provider",
    storedSecrets: {
      MICROSOFT_CLIENT_ID: "microsoft-id",
      MICROSOFT_CLIENT_SECRET: "microsoft-secret",
      MICROSOFT_OAUTH_ENABLED: "true",
      VITE_MICROSOFT_OAUTH_ENABLED: "true",
    },
    update: { method: LOGIN_METHODS.MICROSOFT, enabled: false },
    expectedMethods: { microsoft: false, password: true, magicLink: true },
    expectedPublicSSOFlags: { microsoft: "false" },
  },
  {
    title: "disabling password while magic link stays enabled",
    storedSecrets: {},
    update: { method: LOGIN_METHODS.PASSWORD, enabled: false },
    expectedMethods: { password: false, magicLink: true },
    expectedPublicSSOFlags: {},
  },
] as const;

/** Login switches that the generic env endpoint must refuse to write. */
export const LOGIN_METHOD_FLAGS = [
  "PASSWORD_LOGIN_ENABLED",
  "MAGIC_LINK_LOGIN_ENABLED",
  "GOOGLE_OAUTH_ENABLED",
  "VITE_GOOGLE_OAUTH_ENABLED",
  "MICROSOFT_OAUTH_ENABLED",
  "VITE_MICROSOFT_OAUTH_ENABLED",
  "SLACK_OAUTH_ENABLED",
  "VITE_SLACK_OAUTH_ENABLED",
] as const;

export const AUTH_REQUEST_KINDS = {
  REGISTER: "register",
  PASSWORD_LOGIN: "password login",
  FORGOT_PASSWORD: "forgot password",
  CREATE_PASSWORD: "create password",
  RESET_PASSWORD: "reset password",
  CREATE_MAGIC_LINK: "create magic link",
  VERIFY_MAGIC_LINK: "verify magic link",
} as const;

export type AuthRequestKind = (typeof AUTH_REQUEST_KINDS)[keyof typeof AUTH_REQUEST_KINDS];

export const REQUESTS_BLOCKED_BY_DISABLED_LOGIN_METHOD = [
  { request: AUTH_REQUEST_KINDS.REGISTER, disabledFlag: "PASSWORD_LOGIN_ENABLED" },
  { request: AUTH_REQUEST_KINDS.PASSWORD_LOGIN, disabledFlag: "PASSWORD_LOGIN_ENABLED" },
  { request: AUTH_REQUEST_KINDS.FORGOT_PASSWORD, disabledFlag: "PASSWORD_LOGIN_ENABLED" },
  { request: AUTH_REQUEST_KINDS.CREATE_PASSWORD, disabledFlag: "PASSWORD_LOGIN_ENABLED" },
  { request: AUTH_REQUEST_KINDS.RESET_PASSWORD, disabledFlag: "PASSWORD_LOGIN_ENABLED" },
  { request: AUTH_REQUEST_KINDS.CREATE_MAGIC_LINK, disabledFlag: "MAGIC_LINK_LOGIN_ENABLED" },
  { request: AUTH_REQUEST_KINDS.VERIFY_MAGIC_LINK, disabledFlag: "MAGIC_LINK_LOGIN_ENABLED" },
] as const;
