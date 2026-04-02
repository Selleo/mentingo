import { t } from "i18next";
import { get } from "lodash-es";
import { match, P } from "ts-pattern";

import { toast } from "~/components/ui/use-toast";
import { authService } from "~/modules/Auth/authService";
import { useAuthStore } from "~/modules/Auth/authStore";

import { API } from "./generated-api";

import type { ApiErrorResponse } from "./types";

export const requestManager = {
  controller: new AbortController(),

  abortAll() {
    this.controller.abort();
    this.controller = new AbortController();
  },
};

const baseURL = (() => {
  const importEnvMode = get(import.meta.env, "MODE") || undefined;
  const windowEnvApiUrl =
    get(typeof window !== "undefined" ? window : {}, "ENV.VITE_API_URL") || undefined;
  const importEnvApiUrl = import.meta.env.VITE_API_URL || undefined;
  const processEnvApiUrl =
    get(typeof process !== "undefined" ? process.env : {}, "VITE_API_URL") || undefined;

  const resolvedApiUrl = importEnvApiUrl || windowEnvApiUrl || processEnvApiUrl;

  return match({
    importEnvMode,
    resolvedApiUrl,
  })
    .with({ importEnvMode: "test" }, () => "http://localhost:3000")
    .with({ resolvedApiUrl: P.string }, () => resolvedApiUrl)
    .otherwise(() => undefined);
})();

const API_ERROR_MESSAGE_KEYS = {
  TENANT_INACTIVE: "tenant.error.inactive",
  MISSING_PERMISSION: "auth.error.missingPermission",
  TOO_MANY_REQUESTS: "common.toast.tooManyRequests",
} as const;

export const ApiClient = new API({
  baseURL,
  secure: true,
  withCredentials: true,
});

ApiClient.instance.interceptors.request.use((config) => {
  const isAuthEndpoint =
    config.url?.includes("/login") ||
    config.url?.includes("/refresh") ||
    config.url?.includes("/forgot-password") ||
    config.url?.includes("/register");

  const isPublicSettingsEndpoint =
    config.url?.includes("/settings/global") || config.url?.includes("/settings/registration-form");

  if (!isAuthEndpoint && !isPublicSettingsEndpoint && !useAuthStore.getState().isLoggedIn) {
    config.signal = requestManager.controller.signal;
  }

  return config;
});

ApiClient.instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      const payload = error.response?.data as ApiErrorResponse | undefined;
      const isRateLimitMessageKey = payload?.message === API_ERROR_MESSAGE_KEYS.TOO_MANY_REQUESTS;

      if (isRateLimitMessageKey) {
        const retryAfterSeconds = payload?.retryAfterSeconds ?? 60;

        error.response.data = {
          ...payload,
          message: t(API_ERROR_MESSAGE_KEYS.TOO_MANY_REQUESTS, { seconds: retryAfterSeconds }),
        };
      }
    }

    if (
      error.response?.status === 403 &&
      error.response?.data?.message === API_ERROR_MESSAGE_KEYS.TENANT_INACTIVE &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/tenant-inactive"
    ) {
      window.location.href = "/tenant-inactive";
    }

    if (
      error.response?.status === 403 &&
      error.response?.data?.message === API_ERROR_MESSAGE_KEYS.MISSING_PERMISSION
    ) {
      toast({
        description: t(API_ERROR_MESSAGE_KEYS.MISSING_PERMISSION),
        variant: "destructive",
      });
    }

    if (error.config?.url?.includes("/logout")) {
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !error.config._retry &&
      useAuthStore.getState().isLoggedIn
    ) {
      error.config._retry = true;
      try {
        authService.logout();
        await authService.refreshToken();
        return ApiClient.instance(error.config);
      } catch {
        requestManager.abortAll();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
