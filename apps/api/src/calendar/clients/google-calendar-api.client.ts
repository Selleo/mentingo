import { Injectable } from "@nestjs/common";
import axios, { AxiosError, type Method } from "axios";

import { EnvService } from "src/env/services/env.service";

import { MANAGED_CALENDAR_NAME } from "../calendar.constants";

import type {
  GoogleCalendar,
  GoogleCalendarEvent,
  GoogleCalendarEventsPage,
  GoogleCalendarEventsPageRequest,
  GoogleCalendarOutboundEvent,
  GoogleCalendarWatchChannel,
  GoogleCalendarWatchChannelRequest,
  GoogleTokenResponse,
  GoogleUserProfile,
} from "../types/google-calendar.types";

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_CALENDAR_READ_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const GOOGLE_CALENDAR_MANAGED_CALENDARS_SCOPE =
  "https://www.googleapis.com/auth/calendar.app.created";

export const GOOGLE_CALENDAR_REQUIRED_SCOPES = [
  GOOGLE_CALENDAR_READ_SCOPE,
  GOOGLE_CALENDAR_MANAGED_CALENDARS_SCOPE,
];

const GOOGLE_CALENDAR_SCOPES = ["openid", "email", ...GOOGLE_CALENDAR_REQUIRED_SCOPES];

type GoogleErrorResponse = {
  error?: string | { code?: number; status?: string; message?: string };
  error_description?: string;
};

export class GoogleCalendarApiError extends Error {
  constructor(
    message: string,
    readonly authenticationFailure = false,
    readonly statusCode?: number,
  ) {
    super(message);
  }

  get syncTokenExpired() {
    return this.statusCode === 410;
  }

  get notFound() {
    return this.statusCode === 404 || this.statusCode === 410;
  }
}

@Injectable()
export class GoogleCalendarApiClient {
  constructor(private readonly envService: EnvService) {}

  async isConfigured(): Promise<boolean> {
    const configuration = await this.getConfiguration();
    return Boolean(configuration.clientId && configuration.clientSecret);
  }

  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    const { clientId } = await this.getRequiredConfiguration();

    const url = new URL(GOOGLE_AUTHORIZATION_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent select_account");
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string, redirectUri: string) {
    return this.requestToken({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  }

  async refreshAccessToken(refreshToken: string) {
    return this.requestToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
  }

  async getProfile(accessToken: string): Promise<GoogleUserProfile> {
    return this.sendRequest<GoogleUserProfile>("get", GOOGLE_USERINFO_URL, { accessToken });
  }

  async getEventsPage(
    accessToken: string,
    calendarId: string,
    pageRequest: GoogleCalendarEventsPageRequest,
  ): Promise<GoogleCalendarEventsPage> {
    return this.sendRequest<GoogleCalendarEventsPage>("get", this.getEventsUrl(calendarId), {
      accessToken,
      params: { singleEvents: "true", maxResults: "250", ...pageRequest },
    });
  }

  async listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
    const calendars: GoogleCalendar[] = [];
    let pageToken: string | undefined;

    do {
      const page = await this.sendRequest<{ items?: GoogleCalendar[]; nextPageToken?: string }>(
        "get",
        `${GOOGLE_CALENDAR_API}/users/me/calendarList`,
        { accessToken, params: { maxResults: "250", ...(pageToken ? { pageToken } : {}) } },
      );
      calendars.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);

    return calendars;
  }

  async getCalendar(accessToken: string, calendarId: string): Promise<GoogleCalendar> {
    return this.sendRequest<GoogleCalendar>(
      "get",
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
      { accessToken },
    );
  }

  async createCalendar(accessToken: string, timeZone: string): Promise<GoogleCalendar> {
    return this.sendRequest<GoogleCalendar>("post", `${GOOGLE_CALENDAR_API}/calendars`, {
      accessToken,
      data: { summary: MANAGED_CALENDAR_NAME, timeZone },
    });
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: GoogleCalendarOutboundEvent,
  ): Promise<GoogleCalendarEvent> {
    return this.sendRequest<GoogleCalendarEvent>("post", this.getEventsUrl(calendarId), {
      accessToken,
      data: event,
    });
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: GoogleCalendarOutboundEvent,
  ): Promise<void> {
    await this.sendRequest<GoogleCalendarEvent>(
      "put",
      `${this.getEventsUrl(calendarId)}/${encodeURIComponent(eventId)}`,
      { accessToken, data: event },
    );
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    await this.sendRequest<void>(
      "delete",
      `${this.getEventsUrl(calendarId)}/${encodeURIComponent(eventId)}`,
      { accessToken },
    );
  }

  async watchEvents(
    accessToken: string,
    calendarId: string,
    channel: GoogleCalendarWatchChannelRequest,
  ): Promise<GoogleCalendarWatchChannel> {
    return this.sendRequest<GoogleCalendarWatchChannel>(
      "post",
      `${this.getEventsUrl(calendarId)}/watch`,
      {
        accessToken,
        data: {
          id: channel.channelId,
          type: "web_hook",
          address: channel.address,
          token: channel.token,
          expiration: String(Date.parse(channel.expiresAt)),
        },
      },
    );
  }

  async stopChannel(accessToken: string, channelId: string, resourceId: string): Promise<void> {
    await this.sendRequest<void>("post", `${GOOGLE_CALENDAR_API}/channels/stop`, {
      accessToken,
      data: { id: channelId, resourceId },
    });
  }

  private getEventsUrl(calendarId: string) {
    return `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  }

  private async requestToken(payload: Record<string, string>): Promise<GoogleTokenResponse> {
    const { clientId, clientSecret } = await this.getRequiredConfiguration();

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...payload,
    });

    try {
      const response = await axios.post<GoogleTokenResponse>(GOOGLE_TOKEN_URL, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      return response.data;
    } catch (error) {
      throw this.toGoogleCalendarApiError(error);
    }
  }

  private async sendRequest<T>(
    method: Method,
    url: string,
    options: { accessToken: string; data?: unknown; params?: Record<string, string> },
  ): Promise<T> {
    try {
      const response = await axios.request<T>({
        method,
        url,
        data: options.data,
        params: options.params,
        headers: { Authorization: `Bearer ${options.accessToken}` },
      });
      return response.data;
    } catch (error) {
      throw this.toGoogleCalendarApiError(error);
    }
  }

  private toGoogleCalendarApiError(error: unknown): GoogleCalendarApiError {
    if (!(error instanceof AxiosError)) {
      return new GoogleCalendarApiError("Google Calendar request failed");
    }

    const response = error.response?.data as GoogleErrorResponse | undefined;
    const providerError = response?.error;
    const errorCode = typeof providerError === "string" ? providerError : providerError?.status;
    const providerMessage = [
      response?.error_description,
      typeof providerError === "object" ? providerError.message : undefined,
    ]
      .filter(Boolean)
      .join(" ");
    const statusCode = error.response?.status;

    const authenticationFailure = statusCode === 401 || errorCode === "invalid_grant";

    const details = [
      statusCode ? `status=${statusCode}` : null,
      errorCode ? `code=${errorCode}` : null,
      providerMessage ? `message=${providerMessage}` : null,
    ].filter(Boolean);

    return new GoogleCalendarApiError(
      `Google Calendar request failed${details.length ? ` (${details.join(", ")})` : ""}`,
      authenticationFailure,
      statusCode,
    );
  }

  private async getConfiguration() {
    const [clientId, clientSecret] = await Promise.all(
      ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET"].map((envName) =>
        this.envService
          .getEnv(envName)
          .then(({ value }) => value)
          .catch(() => undefined),
      ),
    );

    return { clientId, clientSecret };
  }

  private async getRequiredConfiguration() {
    const { clientId, clientSecret } = await this.getConfiguration();

    if (!clientId || !clientSecret) {
      throw new GoogleCalendarApiError("Google Calendar is not configured");
    }

    return { clientId, clientSecret };
  }
}
