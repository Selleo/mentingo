import { LOGIN_METHODS } from "@repo/shared";

import type { LoginMethod } from "@repo/shared";
import type { LoginMethodEnvKeys } from "src/env/login-methods.types";

export const LOGIN_METHOD_ENV_KEYS = {
  [LOGIN_METHODS.GOOGLE]: {
    enabledFlag: "GOOGLE_OAUTH_ENABLED",
    publicEnabledFlag: "VITE_GOOGLE_OAUTH_ENABLED",
    credentials: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    enabledByDefault: false,
  },
  [LOGIN_METHODS.MICROSOFT]: {
    enabledFlag: "MICROSOFT_OAUTH_ENABLED",
    publicEnabledFlag: "VITE_MICROSOFT_OAUTH_ENABLED",
    credentials: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    enabledByDefault: false,
  },
  [LOGIN_METHODS.SLACK]: {
    enabledFlag: "SLACK_OAUTH_ENABLED",
    publicEnabledFlag: "VITE_SLACK_OAUTH_ENABLED",
    credentials: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
    enabledByDefault: false,
  },
  [LOGIN_METHODS.MAGIC_LINK]: {
    enabledFlag: "MAGIC_LINK_LOGIN_ENABLED",
    publicEnabledFlag: null,
    credentials: [],
    enabledByDefault: true,
  },
  [LOGIN_METHODS.PASSWORD]: {
    enabledFlag: "PASSWORD_LOGIN_ENABLED",
    publicEnabledFlag: null,
    credentials: [],
    enabledByDefault: true,
  },
} as const satisfies Record<LoginMethod, LoginMethodEnvKeys>;
