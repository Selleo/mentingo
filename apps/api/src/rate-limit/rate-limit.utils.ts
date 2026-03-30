import {
  AUTH_PATHS_LIMIT_10_PER_MINUTE,
  AUTH_PATHS_LIMIT_5_PER_MINUTE,
  AUTH_POLICY_LIMIT_10_PER_MINUTE,
  AUTH_POLICY_LIMIT_5_PER_MINUTE,
  GENERAL_GET_POLICY,
  GENERAL_WRITE_POLICY,
  INTEGRATION_READ_POLICY,
  INTEGRATION_WRITE_POLICY,
  TECHNICAL_PATH_MATCHERS,
} from "./rate-limit.policy";

import type { ResolvedRateLimitPolicy } from "./rate-limit.types";

export const normalizePath = (path: string) => {
  const noQuery = path.split("?")[0].split("#")[0];
  const withLeadingSlash = noQuery.startsWith("/") ? noQuery : `/${noQuery}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1).toLowerCase();
  }

  return withLeadingSlash.toLowerCase();
};

const isTechnicalPath = (path: string) =>
  TECHNICAL_PATH_MATCHERS.some((matcher) => matcher.test(path));

export const resolveRateLimitPolicy = (
  method: string,
  path: string,
): ResolvedRateLimitPolicy | null => {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = normalizePath(path);

  if (isTechnicalPath(normalizedPath)) return null;

  if (AUTH_PATHS_LIMIT_5_PER_MINUTE.has(normalizedPath)) return AUTH_POLICY_LIMIT_5_PER_MINUTE;

  if (AUTH_PATHS_LIMIT_10_PER_MINUTE.has(normalizedPath)) return AUTH_POLICY_LIMIT_10_PER_MINUTE;

  if (normalizedPath.startsWith("/api/integration")) {
    return normalizedMethod === "GET" ? INTEGRATION_READ_POLICY : INTEGRATION_WRITE_POLICY;
  }

  return normalizedMethod === "GET" ? GENERAL_GET_POLICY : GENERAL_WRITE_POLICY;
};
