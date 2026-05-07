import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { format } from "date-fns";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { activityLogs } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";
import { ACTIVITY_LOG_ACTION_TYPES } from "../types";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("ActivityLogsController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;

  const password = "password123";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest({ enableActivityLogs: true });
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  it("returns activity logs with pagination", async () => {
    const admin = await userFactory
      .withCredentials({ password })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

    await db.insert(activityLogs).values([
      {
        actorId: admin.id,
        actorEmail: admin.email,
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType: ACTIVITY_LOG_ACTION_TYPES.CREATE,
        resourceType: "category",
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.CREATE, after: { title: "One" } },
      },
      {
        actorId: admin.id,
        actorEmail: admin.email,
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
        resourceType: "category",
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE, after: { title: "Two" } },
      },
      {
        actorId: admin.id,
        actorEmail: admin.email,
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType: ACTIVITY_LOG_ACTION_TYPES.DELETE,
        resourceType: "category",
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.DELETE, context: { title: "Three" } },
      },
    ]);

    const response = await request(app.getHttpServer())
      .get("/api/activity-logs?page=1&perPage=2")
      .set("Cookie", await cookieFor(admin, app))
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toEqual({
      totalItems: 4,
      page: 1,
      perPage: 2,
    });
    expect(response.body.data[0]).toHaveProperty("id");
    expect(response.body.data[0]).toHaveProperty("createdAt");
    expect(response.body.data[0]).toHaveProperty("actorEmail", admin.email);
    expect(response.body.data[0]).toHaveProperty("metadata");
  });

  it("includes logs created on the to date", async () => {
    const admin = await userFactory
      .withCredentials({ password })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

    const toDate = format(new Date("2026-04-29T00:00:00.000Z"), "yyyy-MM-dd");

    const [includedLog] = await db
      .insert(activityLogs)
      .values({
        actorId: admin.id,
        actorEmail: admin.email,
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType: ACTIVITY_LOG_ACTION_TYPES.CREATE,
        resourceType: "category",
        createdAt: "2026-04-29T12:00:00.000Z",
        updatedAt: "2026-04-29T12:00:00.000Z",
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.CREATE, after: { title: "Late log" } },
      })
      .returning({ id: activityLogs.id });

    const [excludedLog] = await db
      .insert(activityLogs)
      .values({
        actorId: admin.id,
        actorEmail: admin.email,
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType: ACTIVITY_LOG_ACTION_TYPES.CREATE,
        resourceType: "category",
        createdAt: "2026-04-30T00:00:00.000Z",
        updatedAt: "2026-04-30T00:00:00.000Z",
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.CREATE, after: { title: "Next day log" } },
      })
      .returning({ id: activityLogs.id });

    const response = await request(app.getHttpServer())
      .get(`/api/activity-logs?to=${toDate}`)
      .set("Cookie", await cookieFor(admin, app))
      .expect(200);

    const returnedIds = response.body.data.map((log: { id: string }) => log.id);

    expect(returnedIds).toContain(includedLog.id);
    expect(returnedIds).not.toContain(excludedLog.id);

    const returnedDates = response.body.data.map((log: { createdAt: string }) =>
      format(new Date(log.createdAt), "yyyy-MM-dd"),
    );

    expect(returnedDates.every((date: string) => date === toDate)).toBe(true);
  });
});
