import { CALENDAR_PROVIDERS, MICROSOFT_CALENDAR_CONNECTION_STATUSES } from "@repo/shared";

import { MicrosoftGraphError } from "../clients/microsoft-graph-api.client";
import { MicrosoftCalendarService } from "../services/microsoft-calendar.service";
import { MICROSOFT_CALENDAR_SYNC_REASONS } from "../types/microsoft-calendar.types";

import type { MicrosoftCalendarConnection } from "../types/microsoft-calendar.types";

const connection = (overrides: Partial<MicrosoftCalendarConnection> = {}) =>
  ({
    id: "f83a0c69-0271-47e3-a052-958924c8d68b",
    tenantId: "a4d63c7f-018b-4c8c-8b29-04ab4e94a67e",
    userId: "07dde027-268e-4a98-b740-f28ac979614f",
    provider: CALENDAR_PROVIDERS.MICROSOFT,
    accountId: "microsoft-user",
    accountEmail: "calendar@example.com",
    status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.CONNECTED,
    errorCode: null,
    syncCursor: "delta-1",
    syncWindowStart: "2026-06-01T00:00:00.000Z",
    syncWindowEnd: "2027-01-01T00:00:00.000Z",
    windowBuiltAt: new Date().toISOString(),
    lastSuccessfulSyncAt: null,
    lastSyncCompletedAt: null,
    subscriptionId: "subscription-1",
    subscriptionClientState: "client-state",
    subscriptionExpiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    outboundSyncEnabled: true,
    outboundStatus: "connected",
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
  }) as MicrosoftCalendarConnection;

describe("MicrosoftCalendarService synchronization", () => {
  const repository = {
    getConnectionById: jest.fn(),
    getConnectionByUserId: jest.fn(),
    getConnectionBySubscriptionId: jest.fn(),
    updateConnection: jest.fn(),
    upsertEvent: jest.fn(),
    removeEvents: jest.fn(),
    removeEventsMissingFromFullSync: jest.fn(),
  };
  const graph = {
    isConfigured: jest.fn(),
    getAuthorizationUrl: jest.fn(),
    refreshAccessToken: jest.fn(),
    getDeltaPage: jest.fn(),
    renewSubscription: jest.fn(),
    createSubscription: jest.fn(),
  };
  const tokenEncryption = { decrypt: jest.fn(), encrypt: jest.fn() };
  const syncQueue = { enqueue: jest.fn() };
  const tenantState = { signMicrosoftCalendar: jest.fn() };
  const dbAdmin = {
    select: jest.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => [{ host: "https://tenant.example.com" }] }),
      }),
    })),
  };
  const service = new MicrosoftCalendarService(
    repository as never,
    graph as never,
    tokenEncryption as never,
    syncQueue as never,
    tenantState as never,
    { runWithTenant: jest.fn((_tenantId, callback) => callback()) } as never,
    dbAdmin as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    syncQueue.enqueue.mockClear();
    repository.getConnectionById.mockResolvedValue(connection());
    repository.getConnectionByUserId.mockResolvedValue(connection());
    repository.updateConnection.mockResolvedValue(connection());
    tokenEncryption.decrypt.mockReturnValue("refresh-token");
    graph.refreshAccessToken.mockResolvedValue({ access_token: "access-token" });
    repository.getConnectionBySubscriptionId.mockResolvedValue(connection());
    graph.isConfigured.mockResolvedValue(true);
    tenantState.signMicrosoftCalendar.mockResolvedValue("signed-state");
    graph.getAuthorizationUrl.mockResolvedValue("https://login.microsoftonline.com/authorize");
  });

  it("uses the authenticated user's tenant origin for the OAuth redirect", async () => {
    await service.getAuthorizationUrl(
      { tenantId: connection().tenantId, userId: connection().userId } as never,
      false,
    );

    expect(tenantState.signMicrosoftCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: connection().tenantId,
        origin: "https://tenant.example.com",
      }),
    );
    expect(graph.getAuthorizationUrl).toHaveBeenCalledWith(
      "signed-state",
      "https://tenant.example.com/api/auth/microsoft-calendar/callback",
    );
  });

  it("accepts a valid webhook and queues an incremental sync", async () => {
    await expect(
      service.processNotification(
        { subscriptionId: "subscription-1", clientState: "client-state" },
        false,
      ),
    ).resolves.toBe(true);

    expect(syncQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: connection().id,
        fullSync: false,
      }),
    );
  });

  it("follows delta pagination, applies removals and retains the final delta link", async () => {
    graph.getDeltaPage
      .mockResolvedValueOnce({
        value: [
          {
            id: "event-1",
            subject: "Occurrence",
            start: { dateTime: "2026-07-22T09:00:00", timeZone: "UTC" },
            end: { dateTime: "2026-07-22T10:00:00", timeZone: "UTC" },
          },
        ],
        "@odata.nextLink": "delta-2",
      })
      .mockResolvedValueOnce({
        value: [{ id: "event-removed", "@removed": { reason: "deleted" } }],
        "@odata.deltaLink": "delta-final",
      });

    await service.synchronizeConnection(connection().id, false);

    expect(graph.getDeltaPage).toHaveBeenNthCalledWith(1, "delta-1", "access-token");
    expect(graph.getDeltaPage).toHaveBeenNthCalledWith(2, "delta-2", "access-token");
    expect(repository.upsertEvent).toHaveBeenCalledWith(
      connection().id,
      connection().userId,
      expect.objectContaining({ externalEventId: "event-1" }),
    );
    expect(repository.removeEvents).toHaveBeenCalledWith(connection().id, ["event-removed"]);
    expect(repository.updateConnection).toHaveBeenLastCalledWith(
      connection().id,
      expect.objectContaining({
        status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.CONNECTED,
        syncCursor: "delta-final",
      }),
    );
  });

  it("does not let webhook syncs start the manual sync cooldown", async () => {
    graph.getDeltaPage.mockResolvedValue({ value: [], "@odata.deltaLink": "delta-final" });

    await service.synchronizeConnection(
      connection().id,
      false,
      MICROSOFT_CALENDAR_SYNC_REASONS.WEBHOOK,
    );

    expect(repository.updateConnection).toHaveBeenLastCalledWith(
      connection().id,
      expect.not.objectContaining({ lastSyncCompletedAt: expect.anything() }),
    );
  });

  it("stores rotated refresh tokens", async () => {
    graph.getDeltaPage.mockResolvedValue({ value: [], "@odata.deltaLink": "delta-final" });
    graph.refreshAccessToken.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "rotated-refresh-token",
    });
    tokenEncryption.encrypt.mockReturnValue({ refreshTokenCiphertext: "rotated" });

    await service.synchronizeConnection(connection().id, false);

    expect(tokenEncryption.encrypt).toHaveBeenCalledWith("rotated-refresh-token");
    expect(repository.updateConnection).toHaveBeenCalledWith(connection().id, {
      refreshTokenCiphertext: "rotated",
    });
  });

  it("marks revoked authorization for reconnect while retaining imported events", async () => {
    graph.refreshAccessToken.mockRejectedValue(
      new MicrosoftGraphError("invalid grant", true, false),
    );

    await service.synchronizeConnection(connection().id, false);

    expect(repository.removeEvents).not.toHaveBeenCalled();
    expect(repository.updateConnection).toHaveBeenLastCalledWith(
      connection().id,
      expect.objectContaining({
        status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED,
        errorCode: "authorization_expired",
      }),
    );
  });

  it("renews subscriptions within 48 hours", async () => {
    const expiringConnection = connection({
      subscriptionExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    repository.getConnectionById.mockResolvedValue(expiringConnection);
    graph.getDeltaPage.mockResolvedValue({ value: [], "@odata.deltaLink": "delta-final" });
    graph.renewSubscription.mockResolvedValue({
      id: "subscription-1",
      expirationDateTime: "2026-07-27T00:00:00.000Z",
    });

    await service.synchronizeConnection(expiringConnection.id, false);

    expect(graph.renewSubscription).toHaveBeenCalledWith(
      "access-token",
      "subscription-1",
      expect.any(String),
    );
  });

  it("recreates a subscription when Microsoft no longer recognizes it", async () => {
    const removedSubscriptionConnection = connection({
      subscriptionExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    repository.getConnectionById.mockResolvedValue(removedSubscriptionConnection);
    graph.getDeltaPage.mockResolvedValue({ value: [], "@odata.deltaLink": "delta-final" });
    graph.renewSubscription.mockRejectedValue(
      new MicrosoftGraphError("subscription not found", false, false, 404),
    );
    graph.createSubscription.mockResolvedValue({
      id: "subscription-2",
      expirationDateTime: "2026-07-27T00:00:00.000Z",
    });

    await service.synchronizeConnection(removedSubscriptionConnection.id, false);

    expect(graph.createSubscription).toHaveBeenCalledWith(
      "access-token",
      "https://tenant.example.com/api/calendar/microsoft/notifications",
      "https://tenant.example.com/api/calendar/microsoft/lifecycle-notifications",
      expect.any(String),
      expect.any(String),
    );
    expect(repository.updateConnection).toHaveBeenLastCalledWith(
      removedSubscriptionConnection.id,
      expect.objectContaining({ subscriptionId: "subscription-2" }),
    );
  });

  it("records non-authentication sync failures without rethrowing them", async () => {
    graph.getDeltaPage.mockRejectedValue(new Error("Microsoft Graph unavailable"));

    await expect(service.synchronizeConnection(connection().id, false)).resolves.toBeUndefined();

    expect(repository.updateConnection).toHaveBeenLastCalledWith(
      connection().id,
      expect.objectContaining({
        status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.ERROR,
        errorCode: "sync_failed",
      }),
    );
  });
});
