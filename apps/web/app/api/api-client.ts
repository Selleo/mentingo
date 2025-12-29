import { authService } from "~/modules/Auth/authService";
import { useAuthStore } from "~/modules/Auth/authStore";
import { get } from "lodash-es";

import { API } from "./generated-api";
import { match, P } from "ts-pattern";

export const requestManager = {
  controller: new AbortController(),

  abortAll() {
    this.controller.abort();
    this.controller = new AbortController();
  },
};

const baseURL = (() => {
  const importEnvMode = get(import.meta.env, "MODE") || null;
  const windowEnvApiUrl = get(window, "ENV.VITE_API_URL") || null;
  const importEnvApiUrl = get(import.meta.env, "VITE_API_URL") || null;

  return match({
    importEnvMode,
    windowEnvApiUrl,
    importEnvApiUrl,
  })
    .with({ importEnvMode: "test" }, () => "http://localhost:3000")
    .with({ windowEnvApiUrl: P.string }, () => windowEnvApiUrl)
    .with({ importEnvApiUrl: P.string }, () => importEnvApiUrl)
    .exhaustive();
})() as string;

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
