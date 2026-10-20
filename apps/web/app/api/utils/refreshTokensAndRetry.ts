import { authService } from "~/modules/Auth/authService";
import { useAuthStore } from "~/modules/Auth/authStore";

import { API_ERROR_MESSAGE_KEYS, hasApiErrorMessage } from "./apiErrorResponses";

import type { AxiosInstance } from "axios";
import type { ApiError, RetryableApiError } from "~/api/types";

const AUTH_ENDPOINT_PATHS = ["/login", "/refresh", "/forgot-password", "/register", "/logout"];

const isAuthEndpoint = (url?: string) => AUTH_ENDPOINT_PATHS.some((path) => url?.includes(path));

let pendingTokenRefresh: Promise<unknown> | null = null;

/**
 * Shares one refresh request between every call that fails at the same time,
 * so parallel 401/403 responses trigger a single token refresh.
 */
const refreshTokensOnce = () => {
  pendingTokenRefresh ??= authService.refreshToken().finally(() => {
    pendingTokenRefresh = null;
  });

  return pendingTokenRefresh;
};

/**
 * A 401 means the access token expired. A 403 for a missing permission can mean the token
 * still carries permissions from before a deploy or role change, so a fresh token may fix it.
 */
export const canRetryWithRefreshedTokens = (error: ApiError): error is RetryableApiError => {
  if (!error.config || error.config._retry || isAuthEndpoint(error.config.url)) return false;

  if (!useAuthStore.getState().isLoggedIn) return false;

  return (
    error.response?.status === 401 ||
    hasApiErrorMessage(error, 403, API_ERROR_MESSAGE_KEYS.MISSING_PERMISSION)
  );
};

/**
 * Retries the failed request once with fresh tokens. When the refresh fails the user is
 * logged out and the original error is rejected, so queries treat the session as anonymous.
 */
export const retryWithRefreshedTokens = async (
  error: RetryableApiError,
  axiosInstance: AxiosInstance,
) => {
  try {
    await refreshTokensOnce();
  } catch {
    authService.logout();

    return Promise.reject(error);
  }

  return axiosInstance({ ...error.config, _retry: true });
};
