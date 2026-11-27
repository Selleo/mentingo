import {
  CALENDAR_CONNECTION_STATUSES,
  CALENDAR_OUTBOUND_STATUSES,
  CALENDAR_PROVIDERS,
  GOOGLE_CALENDAR_OAUTH_RESULTS,
} from "@repo/shared";

import {
  GOOGLE_CALENDAR_REQUIRED_SCOPES,
  GoogleCalendarApiError,
} from "../clients/google-calendar-api.client";
import { GoogleCalendarService } from "../services/google-calendar.service";
import { GOOGLE_CALENDAR_SYNC_REASONS } from "../types/google-calendar.types";

import type { CalendarConnection } from "../types/calendar-connection.types";

const TENANT_ORIGIN = "https://tenant.example.com";
const GRANTED_SCOPES = ["openid", "email", ...GOOGLE_CALENDAR_REQUIRED_SCOPES].join(" ");

const connection = (overrides: Partial<CalendarConnection> = {}) =>
  ({
    id: "f83a0c69-0271-47e3-a052-958924c8d68b",
    tenantId: "a4d63c7f-018b-4c8c-8b29-04ab4e94a67e",
    userId: "07dde027-268e-4a98-b740-f28ac979614f",
    provider: CALENDAR_PROVIDERS.GOOGLE,
    accountId: "google-user",
    accountEmail: "calendar@example.com",
    status: CALENDAR_CONNECTION_STATUSES.CONNECTED,
    errorCode: null,
    syncCursor: "sync-token-1",
    syncWindowStart: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    syncWindowEnd: new Date(Date.now() + 180 * 86_400_000).toISOString(),
    windowBuiltAt: new Date().toISOString(),
    lastSuccessfulSyncAt: null,
    lastSyncCompletedAt: null,
    subscriptionId: "channel-1",
    subscriptionResourceId: "resource-1",
    subscriptionClientState: "channel-token",
    subscriptionExpiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    outboundSyncEnabled: false,
    outboundStatus: CALENDAR_OUTBOUND_STATUSES.DISABLED,
    outboundCalendarId: null,
    outboundErrorCode: null,
    lastOutboundSyncAt: null,
    refreshTokenCiphertext: "ciphertext",
    refreshTokenIv: "iv",
    refreshTokenTag: "tag",
    refreshTokenEncryptedDek: "dek",
    refreshTokenEncryptedDekIv: "dek-iv",
    refreshTokenEncryptedDekTag: "dek-tag",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }) as CalendarConnection;

const timedEvent = (id: string, startsAt: Date) => ({
  id,
  status: "confirmed" as const,
  summary: "Planning session",
  start: { dateTime: startsAt.toISOString() },
  end: { dateTime: new Date(startsAt.getTime() + 3_600_000).toISOString() },
});

describe("GoogleCalendarService", () => {
  const calendarConnectionRepository = {
    getActiveUserById: jest.fn(),
    getConnectionById: jest.fn(),
    getConnectionByUserId: jest.fn(),
    getConnectionBySubscriptionId: jest.fn(),
    createConnection: jest.fn(),
    updateConnection: jest.fn(),
    deleteConnectionAndEvents: jest.fn(),
    upsertEvent: jest.fn(),
    removeEvents: jest.fn(),
    removeEventsMissingFromFullSync: jest.fn(),
  };
  const googleCalendarApiClient = {
    isConfigured: jest.fn(),
    getAuthorizationUrl: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
    getProfile: jest.fn(),
    getEventsPage: jest.fn(),
    watchEvents: jest.fn(),
    stopChannel: jest.fn(),
  };
  const googleCalendarAccessTokenService = { getAccessToken: jest.fn() };
  const calendarTokenEncryptionService = { encrypt: jest.fn() };
  const googleCalendarSyncQueueService = {
    enqueueInboundSync: jest.fn(),
    enqueueOutboundSync: jest.fn(),
  };
  const tenantStateService = { signGoogleCalendar: jest.fn(), verifyGoogleCalendar: jest.fn() };
  const tenantDbRunnerService = {
    runWithTenant: jest.fn((_tenantId: string, callback: () => unknown) => callback()),
  };
  const dbAdmin = {
    select: jest.fn(() => ({
      from: () => ({ where: () => ({ limit: async () => [{ host: TENANT_ORIGIN }] }) }),
    })),
  };

  const service = new GoogleCalendarService(
    calendarConnectionRepository as never,
    googleCalendarApiClient as never,
    googleCalendarAccessTokenService as never,
    calendarTokenEncryptionService as never,
    googleCalendarSyncQueueService as never,
    tenantStateService as never,
    tenantDbRunnerService as never,
    dbAdmin as never,
  );

  const currentUser = { tenantId: connection().tenantId, userId: connection().userId } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    calendarConnectionRepository.getConnectionById.mockResolvedValue(connection());
    calendarConnectionRepository.getConnectionByUserId.mockResolvedValue(connection());
    calendarConnectionRepository.getConnectionBySubscriptionId.mockResolvedValue(connection());
    calendarConnectionRepository.getActiveUserById.mockResolvedValue({ id: connection().userId });
    calendarConnectionRepository.createConnection.mockResolvedValue(connection());
    calendarConnectionRepository.updateConnection.mockResolvedValue(connection());
    googleCalendarApiClient.isConfigured.mockResolvedValue(true);
    googleCalendarApiClient.getAuthorizationUrl.mockResolvedValue("https://accounts.google.com");
    googleCalendarApiClient.exchangeAuthorizationCode.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      scope: GRANTED_SCOPES,
    });
    googleCalendarApiClient.getProfile.mockResolvedValue({
      sub: "google-user",
      email: "calendar@example.com",
    });
    googleCalendarApiClient.watchEvents.mockResolvedValue({
      id: "channel-2",
      resourceId: "resource-2",
      expiration: String(Date.now() + 7 * 86_400_000),
    });
    googleCalendarAccessTokenService.getAccessToken.mockResolvedValue("access-token");
    calendarTokenEncryptionService.encrypt.mockReturnValue({ refreshTokenCiphertext: "encrypted" });
    tenantStateService.signGoogleCalendar.mockResolvedValue("signed-state");
    tenantStateService.verifyGoogleCalendar.mockResolvedValue({
      tenantId: connection().tenantId,
      userId: connection().userId,
      purpose: "google_calendar",
      nonce: "nonce",
      replace: false,
      outboundSync: false,
      origin: TENANT_ORIGIN,
    });
  });

  describe("authorization", () => {
    it("redirects to Google with the tenant origin callback", async () => {
      await service.getAuthorizationUrl(currentUser, false, true);

      expect(tenantStateService.signGoogleCalendar).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: connection().tenantId,
          userId: connection().userId,
          purpose: "google_calendar",
          outboundSync: true,
          origin: TENANT_ORIGIN,
        }),
      );
      expect(googleCalendarApiClient.getAuthorizationUrl).toHaveBeenCalledWith(
        "signed-state",
        `${TENANT_ORIGIN}/api/auth/google-calendar/callback`,
      );
    });

    it("refuses to start authorization when the tenant has no Google Calendar credentials", async () => {
      googleCalendarApiClient.isConfigured.mockResolvedValue(false);

      await expect(service.getAuthorizationUrl(currentUser, false)).rejects.toThrow(
        "googleCalendar.errors.unavailable",
      );
    });

    it("creates a Google connection and queues the initial full sync", async () => {
      calendarConnectionRepository.getConnectionByUserId.mockResolvedValue(null);

      await expect(
        service.completeAuthorization({ code: "code", state: "signed-state" }),
      ).resolves.toEqual({
        origin: TENANT_ORIGIN,
        result: GOOGLE_CALENDAR_OAUTH_RESULTS.CONNECTED,
      });

      expect(calendarConnectionRepository.createConnection).toHaveBeenCalledWith({
        userId: connection().userId,
        provider: CALENDAR_PROVIDERS.GOOGLE,
        accountId: "google-user",
        accountEmail: "calendar@example.com",
        encryptedRefreshToken: { refreshTokenCiphertext: "encrypted" },
      });
      expect(googleCalendarSyncQueueService.enqueueInboundSync).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: connection().id, fullSync: true }),
      );
      expect(googleCalendarSyncQueueService.enqueueOutboundSync).not.toHaveBeenCalled();
    });

    it("keeps export off when reconnecting an account that only imports", async () => {
      await service.completeAuthorization({ code: "code", state: "signed-state" });

      expect(calendarConnectionRepository.updateConnection).toHaveBeenCalledWith(
        connection().id,
        expect.objectContaining({
          outboundSyncEnabled: false,
          outboundStatus: CALENDAR_OUTBOUND_STATUSES.DISABLED,
        }),
      );
      expect(googleCalendarSyncQueueService.enqueueOutboundSync).not.toHaveBeenCalled();
    });

    it("keeps export on when reconnecting an account that already exports", async () => {
      const exportingConnection = connection({ outboundSyncEnabled: true });
      calendarConnectionRepository.getConnectionByUserId.mockResolvedValue(exportingConnection);
      calendarConnectionRepository.updateConnection.mockResolvedValue(exportingConnection);

      await service.completeAuthorization({ code: "code", state: "signed-state" });

      expect(calendarConnectionRepository.updateConnection).toHaveBeenCalledWith(
        connection().id,
        expect.objectContaining({
          outboundSyncEnabled: true,
          outboundStatus: CALENDAR_OUTBOUND_STATUSES.QUEUED,
        }),
      );
      expect(googleCalendarSyncQueueService.enqueueOutboundSync).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: connection().id }),
      );
    });

    it("does not carry export over to a replacement Google account", async () => {
      calendarConnectionRepository.getConnectionByUserId.mockResolvedValue(
        connection({ outboundSyncEnabled: true }),
      );
      tenantStateService.verifyGoogleCalendar.mockResolvedValue({
        tenantId: connection().tenantId,
        userId: connection().userId,
        purpose: "google_calendar",
        nonce: "nonce",
        replace: true,
        outboundSync: false,
        origin: TENANT_ORIGIN,
      });
      googleCalendarApiClient.getProfile.mockResolvedValue({
        sub: "another-google-user",
        email: "other@example.com",
      });

      await service.completeAuthorization({ code: "code", state: "signed-state" });

      expect(calendarConnectionRepository.createConnection).toHaveBeenCalled();
      expect(googleCalendarSyncQueueService.enqueueOutboundSync).not.toHaveBeenCalled();
    });

    it("does not connect when the user declines a required calendar permission", async () => {
      googleCalendarApiClient.exchangeAuthorizationCode.mockResolvedValue({
        access_token: "access-token",
        refresh_token: "refresh-token",
        scope: `openid email ${GOOGLE_CALENDAR_REQUIRED_SCOPES[0]}`,
      });

      await expect(
        service.completeAuthorization({ code: "code", state: "signed-state" }),
      ).resolves.toEqual({
        origin: TENANT_ORIGIN,
        result: GOOGLE_CALENDAR_OAUTH_RESULTS.PERMISSIONS_MISSING,
      });

      expect(calendarConnectionRepository.createConnection).not.toHaveBeenCalled();
      expect(calendarConnectionRepository.updateConnection).not.toHaveBeenCalled();
    });

    it("rejects authorization without an offline refresh token", async () => {
      googleCalendarApiClient.exchangeAuthorizationCode.mockResolvedValue({
        access_token: "access-token",
        scope: GRANTED_SCOPES,
      });

      await expect(
        service.completeAuthorization({ code: "code", state: "signed-state" }),
      ).rejects.toThrow("googleCalendar.errors.refreshTokenMissing");
    });

    it("rejects invalid OAuth state before exchanging the code", async () => {
      tenantStateService.verifyGoogleCalendar.mockResolvedValue(null);

      await expect(
        service.completeAuthorization({ code: "code", state: "tampered" }),
      ).rejects.toThrow("googleCalendar.errors.invalidState");
      expect(googleCalendarApiClient.exchangeAuthorizationCode).not.toHaveBeenCalled();
    });

    it("requires confirmation before replacing a different Google account", async () => {
      googleCalendarApiClient.getProfile.mockResolvedValue({
        sub: "another-google-user",
        email: "other@example.com",
      });

      await expect(
        service.completeAuthorization({ code: "code", state: "signed-state" }),
      ).resolves.toEqual({
        origin: TENANT_ORIGIN,
        result: GOOGLE_CALENDAR_OAUTH_RESULTS.REPLACEMENT_REQUIRED,
      });

      expect(calendarConnectionRepository.deleteConnectionAndEvents).not.toHaveBeenCalled();
      expect(calendarConnectionRepository.createConnection).not.toHaveBeenCalled();
    });

    it("replaces the previous Google account when the user confirmed it", async () => {
      tenantStateService.verifyGoogleCalendar.mockResolvedValue({
        tenantId: connection().tenantId,
        userId: connection().userId,
        purpose: "google_calendar",
        nonce: "nonce",
        replace: true,
        origin: TENANT_ORIGIN,
      });
      googleCalendarApiClient.getProfile.mockResolvedValue({
        sub: "another-google-user",
        email: "other@example.com",
      });

      await service.completeAuthorization({ code: "code", state: "signed-state" });

      expect(googleCalendarApiClient.stopChannel).toHaveBeenCalledWith(
        "access-token",
        "channel-1",
        "resource-1",
      );
      expect(calendarConnectionRepository.deleteConnectionAndEvents).toHaveBeenCalledWith(
        connection().id,
      );
      expect(calendarConnectionRepository.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: "another-google-user" }),
      );
    });
  });

  describe("export settings", () => {
    it("enables export without reauthorization and queues an outbound sync", async () => {
      await expect(service.setOutboundSync(currentUser, true)).resolves.toEqual({
        authorizationUrl: null,
      });

      expect(calendarConnectionRepository.updateConnection).toHaveBeenCalledWith(
        connection().id,
        expect.objectContaining({
          outboundSyncEnabled: true,
          outboundStatus: CALENDAR_OUTBOUND_STATUSES.QUEUED,
        }),
      );
      expect(googleCalendarSyncQueueService.enqueueOutboundSync).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: connection().id }),
      );
    });

    it("sends the user back to Google when the connection needs reconnecting", async () => {
      calendarConnectionRepository.getConnectionByUserId.mockResolvedValue(
        connection({ status: CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED }),
      );

      await expect(service.setOutboundSync(currentUser, true)).resolves.toEqual({
        authorizationUrl: "https://accounts.google.com",
      });
      expect(googleCalendarSyncQueueService.enqueueOutboundSync).not.toHaveBeenCalled();
    });
  });

  describe("manual sync", () => {
    it("rejects a manual sync during the cooldown", async () => {
      calendarConnectionRepository.getConnectionByUserId.mockResolvedValue(
        connection({ lastSyncCompletedAt: new Date().toISOString() }),
      );

      await expect(service.requestManualSync(currentUser)).rejects.toThrow(
        "googleCalendar.errors.syncCooldown",
      );
      expect(googleCalendarSyncQueueService.enqueueInboundSync).not.toHaveBeenCalled();
    });

    it("queues an incremental inbound sync", async () => {
      await service.requestManualSync(currentUser);

      expect(googleCalendarSyncQueueService.enqueueInboundSync).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: connection().id,
          fullSync: false,
          reason: GOOGLE_CALENDAR_SYNC_REASONS.MANUAL,
        }),
      );
    });
  });

  describe("synchronization", () => {
    it("follows incremental pages, applies cancellations and stores the next sync token", async () => {
      googleCalendarApiClient.getEventsPage
        .mockResolvedValueOnce({
          items: [timedEvent("event-1", new Date(Date.now() + 86_400_000))],
          nextPageToken: "page-2",
        })
        .mockResolvedValueOnce({
          items: [{ id: "event-cancelled", status: "cancelled" }],
          nextSyncToken: "sync-token-2",
        });

      await service.synchronizeConnection(connection().id, false);

      expect(googleCalendarApiClient.getEventsPage).toHaveBeenNthCalledWith(
        1,
        "access-token",
        "primary",
        { syncToken: "sync-token-1" },
      );
      expect(googleCalendarApiClient.getEventsPage).toHaveBeenNthCalledWith(
        2,
        "access-token",
        "primary",
        { syncToken: "sync-token-1", pageToken: "page-2" },
      );
      expect(calendarConnectionRepository.upsertEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: connection().id }),
        expect.objectContaining({ externalEventId: "event-1" }),
      );
      expect(calendarConnectionRepository.removeEvents).toHaveBeenCalledWith(connection().id, [
        "event-cancelled",
      ]);
      expect(calendarConnectionRepository.removeEventsMissingFromFullSync).not.toHaveBeenCalled();
      expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
        connection().id,
        expect.objectContaining({
          status: CALENDAR_CONNECTION_STATUSES.CONNECTED,
          syncCursor: "sync-token-2",
        }),
      );
    });

    it("removes incremental changes that moved outside the import window", async () => {
      googleCalendarApiClient.getEventsPage.mockResolvedValue({
        items: [timedEvent("event-moved", new Date(Date.now() + 400 * 86_400_000))],
        nextSyncToken: "sync-token-2",
      });

      await service.synchronizeConnection(connection().id, false);

      expect(calendarConnectionRepository.upsertEvent).not.toHaveBeenCalled();
      expect(calendarConnectionRepository.removeEvents).toHaveBeenCalledWith(connection().id, [
        "event-moved",
      ]);
    });

    it("falls back to a full window sync when Google expires the sync token", async () => {
      googleCalendarApiClient.getEventsPage
        .mockRejectedValueOnce(new GoogleCalendarApiError("Sync token expired", false, 410))
        .mockResolvedValueOnce({
          items: [timedEvent("event-1", new Date(Date.now() + 86_400_000))],
          nextSyncToken: "sync-token-full",
        });

      await service.synchronizeConnection(connection().id, false);

      expect(googleCalendarApiClient.getEventsPage).toHaveBeenLastCalledWith(
        "access-token",
        "primary",
        { timeMin: expect.any(String), timeMax: expect.any(String) },
      );
      expect(calendarConnectionRepository.removeEventsMissingFromFullSync).toHaveBeenCalledWith(
        connection().id,
        ["event-1"],
      );
      expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
        connection().id,
        expect.objectContaining({
          status: CALENDAR_CONNECTION_STATUSES.CONNECTED,
          syncCursor: "sync-token-full",
        }),
      );
    });

    it("does not let webhook syncs start the manual sync cooldown", async () => {
      googleCalendarApiClient.getEventsPage.mockResolvedValue({
        items: [],
        nextSyncToken: "sync-token-2",
      });

      await service.synchronizeConnection(
        connection().id,
        false,
        GOOGLE_CALENDAR_SYNC_REASONS.WEBHOOK,
      );

      expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
        connection().id,
        expect.not.objectContaining({ lastSyncCompletedAt: expect.anything() }),
      );
    });

    it("ignores connections that belong to another provider", async () => {
      calendarConnectionRepository.getConnectionById.mockResolvedValue(
        connection({ provider: CALENDAR_PROVIDERS.MICROSOFT }),
      );

      await service.synchronizeConnection(connection().id, false);

      expect(calendarConnectionRepository.updateConnection).not.toHaveBeenCalled();
      expect(googleCalendarApiClient.getEventsPage).not.toHaveBeenCalled();
    });

    it("marks revoked authorization for reconnect while retaining imported events", async () => {
      googleCalendarAccessTokenService.getAccessToken.mockRejectedValue(
        new GoogleCalendarApiError("invalid grant", true, 400),
      );

      await service.synchronizeConnection(connection().id, false);

      expect(calendarConnectionRepository.removeEvents).not.toHaveBeenCalled();
      expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
        connection().id,
        expect.objectContaining({
          status: CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED,
          errorCode: "authorization_expired",
        }),
      );
    });

    it("records non-authentication failures without rethrowing them", async () => {
      googleCalendarApiClient.getEventsPage.mockRejectedValue(
        new GoogleCalendarApiError("Google unavailable", false, 503),
      );

      await expect(service.synchronizeConnection(connection().id, false)).resolves.toBeUndefined();

      expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
        connection().id,
        expect.objectContaining({
          status: CALENDAR_CONNECTION_STATUSES.ERROR,
          errorCode: "sync_failed",
        }),
      );
    });
  });

  describe("push channels", () => {
    const expiringConnection = () =>
      connection({ subscriptionExpiresAt: new Date(Date.now() + 3_600_000).toISOString() });

    beforeEach(() => {
      googleCalendarApiClient.getEventsPage.mockResolvedValue({
        items: [],
        nextSyncToken: "sync-token-2",
      });
    });

    it("opens a new channel before expiry and stops the previous one", async () => {
      calendarConnectionRepository.getConnectionById.mockResolvedValue(expiringConnection());

      await service.synchronizeConnection(connection().id, false);

      expect(googleCalendarApiClient.watchEvents).toHaveBeenCalledWith(
        "access-token",
        "primary",
        expect.objectContaining({
          address: `${TENANT_ORIGIN}/api/calendar/google/notifications`,
        }),
      );
      expect(googleCalendarApiClient.stopChannel).toHaveBeenCalledWith(
        "access-token",
        "channel-1",
        "resource-1",
      );
      expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
        connection().id,
        expect.objectContaining({
          subscriptionId: "channel-2",
          subscriptionResourceId: "resource-2",
        }),
      );
    });

    it("keeps a current channel without contacting Google", async () => {
      await service.synchronizeConnection(connection().id, false);

      expect(googleCalendarApiClient.watchEvents).not.toHaveBeenCalled();
      expect(googleCalendarApiClient.stopChannel).not.toHaveBeenCalled();
    });

    it("still completes the sync when Google rejects the push channel", async () => {
      calendarConnectionRepository.getConnectionById.mockResolvedValue(expiringConnection());
      googleCalendarApiClient.watchEvents.mockRejectedValue(
        new GoogleCalendarApiError("WebHook callback must be HTTPS", false, 400),
      );

      await service.synchronizeConnection(connection().id, false);

      expect(googleCalendarApiClient.stopChannel).not.toHaveBeenCalled();
      expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
        connection().id,
        expect.objectContaining({
          status: CALENDAR_CONNECTION_STATUSES.CONNECTED,
          syncCursor: "sync-token-2",
        }),
      );
    });
  });

  describe("notifications", () => {
    it("queues an incremental sync for a valid channel notification", async () => {
      await expect(
        service.processNotification({
          channelId: "channel-1",
          channelToken: "channel-token",
          resourceState: "exists",
        }),
      ).resolves.toBe(true);

      expect(calendarConnectionRepository.getConnectionBySubscriptionId).toHaveBeenCalledWith(
        "channel-1",
        CALENDAR_PROVIDERS.GOOGLE,
      );
      expect(tenantDbRunnerService.runWithTenant).toHaveBeenCalledWith(
        connection().tenantId,
        expect.any(Function),
      );
      expect(googleCalendarSyncQueueService.enqueueInboundSync).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: connection().id,
          fullSync: false,
          reason: GOOGLE_CALENDAR_SYNC_REASONS.WEBHOOK,
        }),
      );
    });

    it("rejects notifications with a wrong channel token", async () => {
      await expect(
        service.processNotification({
          channelId: "channel-1",
          channelToken: "forged-token",
          resourceState: "exists",
        }),
      ).resolves.toBe(false);

      expect(googleCalendarSyncQueueService.enqueueInboundSync).not.toHaveBeenCalled();
    });

    it("acknowledges the initial sync handshake without queueing work", async () => {
      await expect(
        service.processNotification({
          channelId: "channel-1",
          channelToken: "channel-token",
          resourceState: "sync",
        }),
      ).resolves.toBe(true);

      expect(googleCalendarSyncQueueService.enqueueInboundSync).not.toHaveBeenCalled();
    });

    it("ignores notifications without channel headers", async () => {
      await expect(service.processNotification({ resourceState: "exists" })).resolves.toBe(false);

      expect(calendarConnectionRepository.getConnectionBySubscriptionId).not.toHaveBeenCalled();
    });
  });

  describe("disconnection", () => {
    it("removes the local connection even when Google rejects the channel stop", async () => {
      googleCalendarApiClient.stopChannel.mockRejectedValue(new Error("Google unavailable"));

      await service.disconnect(currentUser);

      expect(calendarConnectionRepository.deleteConnectionAndEvents).toHaveBeenCalledWith(
        connection().id,
      );
    });
  });
});
