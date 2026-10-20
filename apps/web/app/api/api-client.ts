import { API } from "./generated-api";
import {
  API_ERROR_MESSAGE_KEYS,
  hasApiErrorMessage,
  redirectToTenantInactivePage,
  showMissingPermissionToast,
  translateRateLimitMessage,
} from "./utils/apiErrorResponses";
import {
  canRetryWithRefreshedTokens,
  retryWithRefreshedTokens,
} from "./utils/refreshTokensAndRetry";
import { resolveApiBaseUrl } from "./utils/resolveApiBaseUrl";

import type { ApiError } from "./types";

const baseURL = resolveApiBaseUrl();

export const ApiClient = new API({
  baseURL,
  secure: true,
  withCredentials: true,
});

ApiClient.instance.interceptors.response.use(
  (response) => response,
  async (error: ApiError) => {
    if (hasApiErrorMessage(error, 429, API_ERROR_MESSAGE_KEYS.TOO_MANY_REQUESTS)) {
      translateRateLimitMessage(error);
    }

    if (hasApiErrorMessage(error, 403, API_ERROR_MESSAGE_KEYS.TENANT_INACTIVE)) {
      redirectToTenantInactivePage();
    }

    if (canRetryWithRefreshedTokens(error)) {
      return retryWithRefreshedTokens(error, ApiClient.instance);
    }

    if (hasApiErrorMessage(error, 403, API_ERROR_MESSAGE_KEYS.MISSING_PERMISSION)) {
      showMissingPermissionToast();
    }

    return Promise.reject(error);
  },
);
