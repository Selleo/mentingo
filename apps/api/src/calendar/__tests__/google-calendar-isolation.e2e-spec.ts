import {
  CALENDAR_CONNECTION_STATUSES,
  CALENDAR_EVENT_SOURCE_TYPES,
  CALENDAR_PROVIDERS,
  OUTLOOK_EVENT_AVAILABILITIES,
  OUTLOOK_EVENT_SENSITIVITIES,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { calendarConnections } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory } from "../../../test/factory/user.factory";
import { ensureTenant } from "../../../test/helpers/tenant-helpers";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { CalendarConnectionRepository } from "../repositories/calendar-connection.repository";
import { CalendarService } from "../services/calendar.service";

import type { INestApplication } from "@nestjs/common";
import type { CalendarProvider } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

const EVENTS_QUERY = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-08-01T00:00:00.000Z",
  language: SUPPORTED_LANGUAGES.EN,
};

describe("Google Calendar isolation (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let calendarService: CalendarService;
  let calendarConnectionRepository: CalendarConnectionRepository;

  beforeAll(async () => {
    const test = await createE2ETest();
    app = test.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    calendarService = app.get(CalendarService);
    calendarConnectionRepository = app.get(CalendarConnectionRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await truncateTables(baseDb, ["calendar_events", "users"]);
  });

  it("shows Google events next to Outlook events only to their owner", async () => {
    const tenantId = await ensureTenant(baseDb);
    const userFactory = createUserFactory(db);
    const admin = await userFactory.withAdminRole().create({ tenantId });
    const otherUser = await userFactory.create({ tenantId });

    const adminGoogleConnection = await createConnection(admin.id, CALENDAR_PROVIDERS.GOOGLE);
    const adminMicrosoftConnection = await createConnection(admin.id, CALENDAR_PROVIDERS.MICROSOFT);
    const otherGoogleConnection = await createConnection(otherUser.id, CALENDAR_PROVIDERS.GOOGLE);

    await calendarConnectionRepository.upsertEvent(
      adminGoogleConnection,
      externalEvent("shared-id", "Google planning", "https://calendar.google.com/event?eid=1"),
    );
    await calendarConnectionRepository.upsertEvent(
      adminMicrosoftConnection,
      externalEvent("shared-id", "Outlook review", "https://outlook.office.com/calendar/item/1"),
    );
    await calendarConnectionRepository.upsertEvent(
      otherGoogleConnection,
      externalEvent("other-id", "Other user's Google event", null),
    );

    const currentAdmin: CurrentUserType = {
      userId: admin.id,
      email: admin.email,
      tenantId,
      roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: Object.values(PERMISSIONS),
    };

    const result = await calendarService.getEvents(EVENTS_QUERY, currentAdmin);

    expect(result.events).toHaveLength(2);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: CALENDAR_EVENT_SOURCE_TYPES.GOOGLE_CALENDAR,
          title: "Google planning",
        }),
        expect.objectContaining({
          sourceType: CALENDAR_EVENT_SOURCE_TYPES.MICROSOFT_OUTLOOK,
          title: "Outlook review",
        }),
      ]),
    );

    const googleEvent = result.events.find(
      (event) => event.sourceType === CALENDAR_EVENT_SOURCE_TYPES.GOOGLE_CALENDAR,
    );
    if (!googleEvent) throw new Error("Google event was not returned");

    await expect(
      calendarService.getEventDetails(googleEvent.id, SUPPORTED_LANGUAGES.EN, currentAdmin),
    ).resolves.toEqual(
      expect.objectContaining({
        sourceType: CALENDAR_EVENT_SOURCE_TYPES.GOOGLE_CALENDAR,
        payload: {
          googleCalendar: {
            webLink: "https://calendar.google.com/event?eid=1",
            isSensitive: false,
            availability: OUTLOOK_EVENT_AVAILABILITIES.BUSY,
          },
        },
      }),
    );

    const currentOtherUser: CurrentUserType = {
      userId: otherUser.id,
      email: otherUser.email,
      tenantId,
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
      permissions: Object.values(PERMISSIONS),
    };
    const otherUserEvents = await calendarService.getEvents(EVENTS_QUERY, currentOtherUser);
    const [otherUserGoogleEvent] = otherUserEvents.events;

    await expect(
      calendarService.getEventDetails(
        otherUserGoogleEvent.id,
        SUPPORTED_LANGUAGES.EN,
        currentAdmin,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("keeps Google and Microsoft connections apart in provider-scoped lookups", async () => {
    const tenantId = await ensureTenant(baseDb);
    const user = await createUserFactory(db).create({ tenantId });
    const googleConnection = await createConnection(user.id, CALENDAR_PROVIDERS.GOOGLE, {
      subscriptionId: "google-channel",
    });
    const microsoftConnection = await createConnection(user.id, CALENDAR_PROVIDERS.MICROSOFT);

    await expect(
      calendarConnectionRepository.getConnectionByUserId(user.id, CALENDAR_PROVIDERS.GOOGLE),
    ).resolves.toMatchObject({ id: googleConnection.id });
    await expect(
      calendarConnectionRepository.listConnectionsForReconciliation(CALENDAR_PROVIDERS.MICROSOFT),
    ).resolves.toEqual([expect.objectContaining({ id: microsoftConnection.id })]);
    await expect(
      calendarConnectionRepository.getConnectionBySubscriptionId(
        "google-channel",
        CALENDAR_PROVIDERS.MICROSOFT,
      ),
    ).resolves.toBeNull();
    await expect(
      calendarConnectionRepository.getConnectionBySubscriptionId(
        "google-channel",
        CALENDAR_PROVIDERS.GOOGLE,
      ),
    ).resolves.toMatchObject({ id: googleConnection.id });
  });

  const createConnection = async (
    userId: UUIDType,
    provider: CalendarProvider,
    overrides: { subscriptionId?: string } = {},
  ) => {
    const [connection] = await db
      .insert(calendarConnections)
      .values({
        userId,
        provider,
        accountId: `${provider}-${userId}`,
        accountEmail: `${provider}@example.com`,
        refreshTokenCiphertext: "ciphertext",
        refreshTokenIv: "iv",
        refreshTokenTag: "tag",
        refreshTokenEncryptedDek: "encrypted-dek",
        refreshTokenEncryptedDekIv: "dek-iv",
        refreshTokenEncryptedDekTag: "dek-tag",
        status: CALENDAR_CONNECTION_STATUSES.CONNECTED,
        ...overrides,
      })
      .returning({
        id: calendarConnections.id,
        userId: calendarConnections.userId,
        provider: calendarConnections.provider,
      });
    return connection;
  };

  const externalEvent = (externalEventId: string, title: string, webLink: string | null) => ({
    externalEventId,
    title,
    startsAt: "2026-07-22T09:00:00.000Z",
    endsAt: "2026-07-22T10:00:00.000Z",
    allDay: false,
    timezone: "UTC",
    location: null,
    isCancelled: false,
    availability: OUTLOOK_EVENT_AVAILABILITIES.BUSY,
    sensitivity: OUTLOOK_EVENT_SENSITIVITIES.NORMAL,
    webLink,
  });
});
