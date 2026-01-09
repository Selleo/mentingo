import { get } from "lodash-es";
import { match, P } from "ts-pattern";

import { authService } from "~/modules/Auth/authService";
import { useAuthStore } from "~/modules/Auth/authStore";

import { API } from "./generated-api";

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

  const isSettingsGlobalEndpoint = config.url?.includes("/settings/global");

  if (!isAuthEndpoint && !isSettingsGlobalEndpoint && !useAuthStore.getState().isLoggedIn) {
    config.signal = requestManager.controller.signal;
  }

  return config;
});

ApiClient.instance.interceptors.response.use(
  (response) => response,
  async (error) => {
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
