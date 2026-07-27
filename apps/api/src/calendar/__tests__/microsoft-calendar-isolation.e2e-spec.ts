import {
  CALENDAR_PROVIDERS,
  CALENDAR_EVENT_SOURCE_TYPES,
  MICROSOFT_CALENDAR_CONNECTION_STATUSES,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { calendarEvents, calendarConnections, calendarExternalEvents } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory } from "../../../test/factory/user.factory";
import { ensureTenant } from "../../../test/helpers/tenant-helpers";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { CalendarService } from "../services/calendar.service";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

describe("Microsoft Outlook calendar isolation (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let calendarService: CalendarService;

  beforeAll(async () => {
    const test = await createE2ETest();
    app = test.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    calendarService = app.get(CalendarService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await truncateTables(baseDb, ["calendar_events", "users"]);
  });

  it("keeps Outlook events owner-only, including for tenant administrators", async () => {
    const tenantId = await ensureTenant(baseDb);
    const userFactory = createUserFactory(db);
    const admin = await userFactory.withAdminRole().create({ tenantId });
    const otherUser = await userFactory.create({ tenantId });
    const adminConnectionId = await createConnection(admin.id, "admin@example.com");
    const otherConnectionId = await createConnection(otherUser.id, "other@example.com");
    const adminEventId = await createOutlookEvent(adminConnectionId, admin.id, "Admin event");
    const otherEventId = await createOutlookEvent(
      otherConnectionId,
      otherUser.id,
      "Other user's event",
    );
    await createOutlookEvent(adminConnectionId, admin.id, "Cancelled event", true);

    const currentAdmin: CurrentUserType = {
      userId: admin.id,
      email: admin.email,
      tenantId,
      roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: Object.values(PERMISSIONS),
    };
    const query = {
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
      language: SUPPORTED_LANGUAGES.EN,
    };

    const result = await calendarService.getEvents(query, currentAdmin);

    expect(result.events).toEqual([
      expect.objectContaining({
        id: adminEventId,
        sourceType: CALENDAR_EVENT_SOURCE_TYPES.MICROSOFT_OUTLOOK,
        title: "Admin event",
      }),
    ]);
    await expect(
      calendarService.getEventDetails(otherEventId, SUPPORTED_LANGUAGES.EN, currentAdmin),
    ).rejects.toMatchObject({ status: 404 });
  });

  const createConnection = async (userId: UUIDType, email: string) => {
    const [connection] = await db
      .insert(calendarConnections)
      .values({
        userId,
        provider: CALENDAR_PROVIDERS.MICROSOFT,
        accountId: `microsoft-${userId}`,
        accountEmail: email,
        refreshTokenCiphertext: "ciphertext",
        refreshTokenIv: "iv",
        refreshTokenTag: "tag",
        refreshTokenEncryptedDek: "encrypted-dek",
        refreshTokenEncryptedDekIv: "dek-iv",
        refreshTokenEncryptedDekTag: "dek-tag",
        status: MICROSOFT_CALENDAR_CONNECTION_STATUSES.CONNECTED,
      })
      .returning({ id: calendarConnections.id });
    return connection.id;
  };

  const createOutlookEvent = async (
    connectionId: UUIDType,
    userId: UUIDType,
    title: string,
    isCancelled = false,
  ) => {
    const [calendarEvent] = await db
      .insert(calendarEvents)
      .values({
        uid: `microsoft-outlook:${userId}:${title}`,
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales: [SUPPORTED_LANGUAGES.EN],
        title: buildJsonbField(SUPPORTED_LANGUAGES.EN, title),
        description: null,
        startsAt: "2026-07-22T09:00:00.000Z",
        endsAt: "2026-07-22T10:00:00.000Z",
        allDay: false,
        timezone: "UTC",
        location: "Room 1",
        status: isCancelled ? "cancelled" : "scheduled",
      })
      .returning({ id: calendarEvents.id });

    await db.insert(calendarExternalEvents).values({
      connectionId,
      calendarEventId: calendarEvent.id,
      userId,
      externalEventId: `microsoft-${calendarEvent.id}`,
      webLink: "https://outlook.office.com/calendar/item/1",
      sensitivity: "normal",
      availability: "busy",
      isCancelled,
    });

    return calendarEvent.id;
  };
});
