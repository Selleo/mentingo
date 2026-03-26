import { RATE_LIMITS, RATE_LIMIT_WINDOW_SEC } from "./rate-limit.constants";

import type { ResolvedRateLimitPolicy } from "./rate-limit.types";

export const TECHNICAL_PATH_MATCHERS = [
  /^\/api\/healthcheck\/?$/,
  /^\/api\/?$/,
  /^\/api\/integration\/?$/,
  /^\/api\/integration-json\/?$/,
  /^\/api\/integration\/swagger-ui.*$/,
  /^\/api\/integration\/favicon-.*\.png$/,
];

export const AUTH_PATHS_LIMIT_5_PER_MINUTE = new Set([
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/magic-link/create",
]);

export const AUTH_PATHS_LIMIT_10_PER_MINUTE = new Set([
  "/api/auth/register",
  "/api/auth/create-password",
  "/api/auth/reset-password",
  "/api/auth/mfa/verify",
]);

export const AUTH_POLICY_LIMIT_5_PER_MINUTE: ResolvedRateLimitPolicy = {
  key: "auth.strict.5",
  limit: RATE_LIMITS.AUTH_SENSITIVE_ENDPOINTS_REQUESTS_PER_MINUTE,
  windowSec: RATE_LIMIT_WINDOW_SEC,
};

export const AUTH_POLICY_LIMIT_10_PER_MINUTE: ResolvedRateLimitPolicy = {
  key: "auth.strict.10",
  limit: RATE_LIMITS.AUTH_STANDARD_ENDPOINTS_REQUESTS_PER_MINUTE,
  windowSec: RATE_LIMIT_WINDOW_SEC,
};

export const INTEGRATION_READ_POLICY: ResolvedRateLimitPolicy = {
  key: "integration.read",
  limit: RATE_LIMITS.INTEGRATION_READ_REQUESTS_PER_MINUTE,
  windowSec: RATE_LIMIT_WINDOW_SEC,
};

export const INTEGRATION_WRITE_POLICY: ResolvedRateLimitPolicy = {
  key: "integration.write",
  limit: RATE_LIMITS.INTEGRATION_WRITE_REQUESTS_PER_MINUTE,
  windowSec: RATE_LIMIT_WINDOW_SEC,
};

export const GENERAL_GET_POLICY: ResolvedRateLimitPolicy = {
  key: "general.get",
  limit: RATE_LIMITS.GENERAL_GET_REQUESTS_PER_MINUTE,
  windowSec: RATE_LIMIT_WINDOW_SEC,
};

export const GENERAL_WRITE_POLICY: ResolvedRateLimitPolicy = {
  key: "general.write",
  limit: RATE_LIMITS.GENERAL_WRITE_REQUESTS_PER_MINUTE,
  windowSec: RATE_LIMIT_WINDOW_SEC,
};
