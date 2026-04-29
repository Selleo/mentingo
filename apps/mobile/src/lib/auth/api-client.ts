import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { API_BASE_URL, TENANT_HOST } from "@/config/env";

import { clearTokens, loadTokens, saveTokens } from "./storage";

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  config.headers.set("X-Tenant-Host", TENANT_HOST);
  if (inMemoryAccessToken && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${inMemoryAccessToken}`);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  try {
    const { data } = await axios.post<{
      data: { accessToken: string; refreshToken: string };
    }>(
      `${API_BASE_URL}/auth/refresh`,
      {},
      {
        headers: {
          Authorization: `Bearer ${tokens.refreshToken}`,
          "X-Tenant-Host": TENANT_HOST,
        },
      },
    );

    const next = data.data;
    await saveTokens(next);
    setAccessToken(next.accessToken);
    return next.accessToken;
  } catch {
    await clearTokens();
    setAccessToken(null);
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !original || original._retry) {
      throw error;
    }

    const skipPaths = ["/auth/login", "/auth/refresh", "/auth/mfa/verify"];
    if (skipPaths.some((p) => original.url?.includes(p))) {
      throw error;
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (!newToken) {
      onUnauthorized?.();
      throw error;
    }

    original.headers.set("Authorization", `Bearer ${newToken}`);
    return apiClient.request(original);
  },
);
