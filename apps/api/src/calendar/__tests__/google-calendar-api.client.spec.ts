import axios, { AxiosError, AxiosHeaders } from "axios";

import {
  GOOGLE_CALENDAR_REQUIRED_SCOPES,
  GoogleCalendarApiClient,
  GoogleCalendarApiError,
} from "../clients/google-calendar-api.client";

const REDIRECT_URI = "https://tenant.example.com/api/auth/google-calendar/callback";

const googleError = (status: number, data: unknown) =>
  new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    statusText: "error",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe("GoogleCalendarApiClient", () => {
  const envService = { getEnv: jest.fn() };
  const client = new GoogleCalendarApiClient(envService as never);

  beforeEach(() => {
    jest.restoreAllMocks();
    envService.getEnv.mockReset();
    envService.getEnv.mockImplementation((name: string) =>
      Promise.resolve({
        name,
        value: name === "GOOGLE_CALENDAR_CLIENT_ID" ? "tenant-calendar-client-id" : "tenant-secret",
      }),
    );
  });

  it("builds an offline consent URL from tenant-managed calendar credentials", async () => {
    const authorizationUrl = new URL(
      await client.getAuthorizationUrl("signed-state", REDIRECT_URI),
    );
    const scopes = authorizationUrl.searchParams.get("scope")?.split(" ") ?? [];

    expect(authorizationUrl.searchParams.get("client_id")).toBe("tenant-calendar-client-id");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(authorizationUrl.searchParams.get("state")).toBe("signed-state");
    expect(authorizationUrl.searchParams.get("access_type")).toBe("offline");
    expect(authorizationUrl.searchParams.get("prompt")).toContain("consent");
    expect(scopes).toEqual(expect.arrayContaining(GOOGLE_CALENDAR_REQUIRED_SCOPES));
    expect(envService.getEnv).toHaveBeenCalledWith("GOOGLE_CALENDAR_CLIENT_ID");
    expect(envService.getEnv).toHaveBeenCalledWith("GOOGLE_CALENDAR_CLIENT_SECRET");
  });

  it("is unavailable when tenant calendar credentials are missing", async () => {
    envService.getEnv.mockRejectedValue(new Error("Secret not found"));

    await expect(client.isConfigured()).resolves.toBe(false);
    await expect(client.getAuthorizationUrl("signed-state", REDIRECT_URI)).rejects.toThrow(
      new GoogleCalendarApiError("Google Calendar is not configured"),
    );
  });

  it("marks a revoked refresh token as an authentication failure", async () => {
    jest
      .spyOn(axios, "post")
      .mockRejectedValue(
        googleError(400, { error: "invalid_grant", error_description: "Revoked" }),
      );

    const error = await client.refreshAccessToken("refresh-token").catch((caught) => caught);

    expect(error).toBeInstanceOf(GoogleCalendarApiError);
    expect(error.authenticationFailure).toBe(true);
    expect(error.message).not.toContain("refresh-token");
  });

  it("reports expired sync tokens so the caller can run a full sync", async () => {
    jest
      .spyOn(axios, "request")
      .mockRejectedValue(googleError(410, { error: { code: 410, message: "Sync token expired" } }));

    const error = await client
      .getEventsPage("access-token", "primary", { syncToken: "sync-token" })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(GoogleCalendarApiError);
    expect(error.syncTokenExpired).toBe(true);
    expect(error.notFound).toBe(true);
    expect(error.authenticationFailure).toBe(false);
  });

  it("requests expanded single events with the sync token", async () => {
    const request = jest
      .spyOn(axios, "request")
      .mockResolvedValue({ data: { items: [], nextSyncToken: "next" } });

    await client.getEventsPage("access-token", "primary", { syncToken: "sync-token" });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        params: expect.objectContaining({ singleEvents: "true", syncToken: "sync-token" }),
        headers: { Authorization: "Bearer access-token" },
      }),
    );
  });

  it("opens a web hook channel with the channel token and expiration", async () => {
    const request = jest
      .spyOn(axios, "request")
      .mockResolvedValue({ data: { id: "channel-1", resourceId: "resource-1" } });

    await client.watchEvents("access-token", "primary", {
      channelId: "channel-1",
      address: "https://tenant.example.com/api/calendar/google/notifications",
      token: "channel-token",
      expiresAt: "2026-07-27T00:00:00.000Z",
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
        data: {
          id: "channel-1",
          type: "web_hook",
          address: "https://tenant.example.com/api/calendar/google/notifications",
          token: "channel-token",
          expiration: String(Date.parse("2026-07-27T00:00:00.000Z")),
        },
      }),
    );
  });
});
