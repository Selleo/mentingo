import { AxiosHeaders } from "axios";

import { API } from "~/api/generated-api";

import type { BrowserContext, Cookie } from "@playwright/test";

const DEFAULT_API_URL = "http://localhost:3000";

const normalizeApiBaseUrl = (value: string) => {
  return value.replace(/\/api\/?$/, "").replace(/\/$/, "");
};

const normalizeOrigin = (value: string) => {
  return new URL(value).origin.replace(/\/$/, "");
};

const resolveApiBaseUrl = () => {
  return normalizeApiBaseUrl(process.env.API_URL ?? process.env.VITE_API_URL ?? DEFAULT_API_URL);
};

const cookieHeaderFromCookies = (cookies: Cookie[]) => {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
};

export class FixtureApiClient {
  public readonly api: API<unknown>["api"];

  private cookieHeader: string | undefined;
  private tenantOrigin: string | undefined;

  private readonly client: API<unknown>;

  constructor(baseURL = resolveApiBaseUrl()) {
    this.client = new API({
      baseURL,
      secure: false,
      withCredentials: true,
    });
    this.api = this.client.api;

    this.client.instance.interceptors.request.use((config) => {
      const headers = AxiosHeaders.from(config.headers);

      if (this.tenantOrigin) {
        headers.set("Origin", this.tenantOrigin);
        headers.set("Referer", `${this.tenantOrigin}/`);
      }

      if (this.cookieHeader) {
        headers.set("Cookie", this.cookieHeader);
      }

      config.headers = headers;

      return config;
    });
  }

  syncCookies(cookies: Cookie[]) {
    this.cookieHeader = cookieHeaderFromCookies(cookies);
  }

  syncTenantOrigin(origin: string) {
    this.tenantOrigin = normalizeOrigin(origin);
  }

  async syncFromContext(context: BrowserContext, origin: string) {
    this.syncTenantOrigin(origin);
    this.syncCookies(await context.cookies());
  }

  clearCookies() {
    this.cookieHeader = undefined;
  }
}

export const createFixtureApiClient = (baseURL?: string) => new FixtureApiClient(baseURL);
