import { Client, GraphError } from "@microsoft/microsoft-graph-client";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosError } from "axios";

import { EnvService } from "src/env/services/env.service";

import {
  MICROSOFT_CALENDAR_DEFAULT_MARKER_PROPERTY,
  MICROSOFT_CALENDAR_NAME,
} from "../calendar.constants";

import type {
  MicrosoftGraphDeltaPage,
  MicrosoftGraphProfile,
  MicrosoftGraphCalendar,
  MicrosoftGraphEvent,
  MicrosoftGraphOutboundEvent,
  MicrosoftGraphSubscription,
  MicrosoftTokenResponse,
} from "../types/microsoft-calendar.types";

const MICROSOFT_AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const MICROSOFT_GRAPH = "https://graph.microsoft.com/v1.0";
export const MICROSOFT_MENTINGO_MARKER_PROPERTY = MICROSOFT_CALENDAR_DEFAULT_MARKER_PROPERTY;
const MICROSOFT_CALENDAR_SCOPES = ["User.Read", "Calendars.ReadWrite", "offline_access"];

type MicrosoftGraphErrorResponse = {
  error?: string | { code?: string; message?: string };
  error_description?: string;
};

const getProviderErrorDetails = (data: unknown) => {
  const response = data as MicrosoftGraphErrorResponse | undefined;
  const error = response?.error;
  const code = typeof error === "string" ? error : error?.code;
  const message = [
    response?.error_description,
    typeof error === "object" ? error.message : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return { code, message };
};

// Microsoft returns these phrases/codes when the tenant administrator must grant consent for the calendar permissions requested by the application.
const isAdminConsentError = (message: string) =>
  ["admin approval", "admin consent", "aadsts65001", "aadsts90094"].some((term) =>
    message.toLowerCase().includes(term),
  );

export class MicrosoftGraphError extends Error {
  constructor(
    message: string,
    readonly authenticationFailure = false,
    readonly adminConsentRequired = false,
    readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MicrosoftGraphApiClient {
  constructor(
    private readonly envService: EnvService,
    private readonly configService: ConfigService,
  ) {}

  async isConfigured(): Promise<boolean> {
    const configuration = await this.getConfiguration();
    return Boolean(configuration.clientId && configuration.clientSecret);
  }

  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    const { clientId } = await this.getRequiredConfiguration();

    const url = new URL(`${MICROSOFT_AUTHORITY}/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", MICROSOFT_CALENDAR_SCOPES.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string, redirectUri: string) {
    return this.requestToken({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  }

  async refreshAccessToken(refreshToken: string) {
    return this.requestToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
  }

  async getProfile(accessToken: string): Promise<MicrosoftGraphProfile> {
    return this.graphGet<MicrosoftGraphProfile>(
      `${MICROSOFT_GRAPH}/me?$select=id,mail,userPrincipalName`,
      accessToken,
    );
  }

  async getDeltaPage(url: string, accessToken: string): Promise<MicrosoftGraphDeltaPage> {
    return this.graphGet<MicrosoftGraphDeltaPage>(url, accessToken, {
      Prefer: 'outlook.timezone="UTC"',
    });
  }

  async listCalendars(accessToken: string): Promise<MicrosoftGraphCalendar[]> {
    const response = await this.graphGet<{ value: MicrosoftGraphCalendar[] }>(
      `${MICROSOFT_GRAPH}/me/calendars?$select=id,name,isDefaultCalendar`,
      accessToken,
    );
    return response.value;
  }

  async createCalendar(
    accessToken: string,
    name = MICROSOFT_CALENDAR_NAME,
  ): Promise<MicrosoftGraphCalendar> {
    return this.graphRequest<MicrosoftGraphCalendar>("post", `${MICROSOFT_GRAPH}/me/calendars`, {
      accessToken,
      data: { name },
    });
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: MicrosoftGraphOutboundEvent,
  ): Promise<MicrosoftGraphEvent> {
    return this.graphRequest<MicrosoftGraphEvent>(
      "post",
      `${MICROSOFT_GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events`,
      { accessToken, data: event },
    );
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: MicrosoftGraphOutboundEvent,
  ): Promise<void> {
    await this.graphRequest<void>(
      "patch",
      `${MICROSOFT_GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { accessToken, data: event },
    );
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    await this.graphRequest<void>(
      "delete",
      `${MICROSOFT_GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { accessToken },
    );
  }

  buildInitialDeltaUrl(start: string, end: string): string {
    const url = new URL(`${MICROSOFT_GRAPH}/me/calendarView/delta`);

    url.searchParams.set("startDateTime", start);
    url.searchParams.set("endDateTime", end);
    url.searchParams.set(
      "$select",
      "id,subject,start,end,isAllDay,location,isCancelled,showAs,webLink,sensitivity,singleValueExtendedProperties",
    );
    url.searchParams.set(
      "$expand",
      `singleValueExtendedProperties($filter=id eq '${this.getMarkerProperty()}')`,
    );

    return url.toString();
  }

  getManagedEventMarkerProperty() {
    return this.getMarkerProperty();
  }

  async createSubscription(
    accessToken: string,
    notificationUrl: string,
    lifecycleNotificationUrl: string,
    clientState: string,
    expirationDateTime: string,
  ): Promise<MicrosoftGraphSubscription> {
    return this.graphRequest<MicrosoftGraphSubscription>(
      "post",
      `${MICROSOFT_GRAPH}/subscriptions`,
      {
        accessToken,
        data: {
          changeType: "created,updated,deleted",
          notificationUrl,
          lifecycleNotificationUrl,
          resource: "/me/events",
          expirationDateTime,
          clientState,
        },
      },
    );
  }

  async renewSubscription(
    accessToken: string,
    subscriptionId: string,
    expirationDateTime: string,
  ): Promise<MicrosoftGraphSubscription> {
    return this.graphRequest<MicrosoftGraphSubscription>(
      "patch",
      `${MICROSOFT_GRAPH}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { accessToken, data: { expirationDateTime } },
    );
  }

  async deleteSubscription(accessToken: string, subscriptionId: string): Promise<void> {
    await this.graphRequest<void>(
      "delete",
      `${MICROSOFT_GRAPH}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { accessToken },
    );
  }

  private async requestToken(payload: Record<string, string>): Promise<MicrosoftTokenResponse> {
    const { clientId, clientSecret } = await this.getRequiredConfiguration();

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: MICROSOFT_CALENDAR_SCOPES.join(" "),
      ...payload,
    });

    try {
      const response = await axios.post<MicrosoftTokenResponse>(
        `${MICROSOFT_AUTHORITY}/token`,
        body,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );
      return response.data;
    } catch (error) {
      const mappedError = this.mapError(error);
      throw mappedError;
    }
  }

  private graphGet<T>(url: string, accessToken: string, headers?: Record<string, string>) {
    return this.graphRequest<T>("get", url, { accessToken, headers });
  }

  private createGraphClient(accessToken: string) {
    return Client.init({
      authProvider: (done) => done(null, accessToken),
      baseUrl: MICROSOFT_GRAPH,
    });
  }

  private async graphRequest<T>(
    method: "get" | "post" | "patch" | "delete",
    url: string,
    options: {
      accessToken: string;
      data?: unknown;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    try {
      const request = this.createGraphClient(options.accessToken)
        .api(url)
        .headers(options.headers ?? {});

      switch (method) {
        case "get":
          return (await request.get()) as T;
        case "post":
          return (await request.post(options.data)) as T;
        case "patch":
          return (await request.patch(options.data)) as T;
        case "delete":
          return (await request.delete()) as T;
      }
    } catch (error) {
      const mappedError = this.mapError(error);
      throw mappedError;
    }
  }

  private mapError(error: unknown): MicrosoftGraphError {
    if (error instanceof GraphError) {
      const response = error.body as MicrosoftGraphErrorResponse | undefined;

      const { code: providerCode, message: providerMessage } = getProviderErrorDetails(response);

      const errorCode = providerCode ?? error.code ?? undefined;
      const message = providerMessage || error.message;

      const authenticationFailure =
        error.statusCode === 401 || errorCode === "InvalidAuthenticationToken";
      const adminConsentRequired = isAdminConsentError(message);

      const details = [
        error.statusCode > 0 ? `status=${error.statusCode}` : null,
        errorCode ? `code=${errorCode}` : null,
        message ? `message=${message}` : null,
      ].filter(Boolean);

      return new MicrosoftGraphError(
        `Microsoft Graph request failed${details.length ? ` (${details.join(", ")})` : ""}`,
        authenticationFailure,
        adminConsentRequired,
        error.statusCode > 0 ? error.statusCode : undefined,
      );
    }

    if (!(error instanceof AxiosError)) return new MicrosoftGraphError("Microsoft Graph failed");

    const { code: errorCode, message: providerMessage } = getProviderErrorDetails(
      error.response?.data,
    );

    const authenticationFailure =
      error.response?.status === 401 ||
      errorCode === "invalid_grant" ||
      errorCode === "InvalidAuthenticationToken";

    const adminConsentRequired = isAdminConsentError(providerMessage);

    const details = [
      error.response?.status ? `status=${error.response.status}` : null,
      errorCode ? `code=${errorCode}` : null,
      providerMessage ? `message=${providerMessage}` : null,
    ].filter(Boolean);

    return new MicrosoftGraphError(
      `Microsoft Graph request failed${details.length ? ` (${details.join(", ")})` : ""}`,
      authenticationFailure,
      adminConsentRequired,
      error.response?.status,
    );
  }

  private async getConfiguration() {
    const [clientId, clientSecret] = await Promise.all(
      ["MICROSOFT_CALENDAR_CLIENT_ID", "MICROSOFT_CALENDAR_CLIENT_SECRET"].map((envName) =>
        this.envService
          .getEnv(envName)
          .then(({ value }) => value)
          .catch(() => undefined),
      ),
    );

    return { clientId, clientSecret };
  }

  private getMarkerProperty() {
    return (
      this.configService.get<string>(
        "microsoft_authorization.MICROSOFT_MENTINGO_MARKER_PROPERTY",
      ) ?? MICROSOFT_CALENDAR_DEFAULT_MARKER_PROPERTY
    );
  }

  private async getRequiredConfiguration() {
    const configuration = await this.getConfiguration();

    if (!configuration.clientId || !configuration.clientSecret)
      throw new MicrosoftGraphError("Microsoft Calendar is not configured");

    return configuration as { clientId: string; clientSecret: string };
  }
}
