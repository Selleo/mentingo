import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
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

    await db.insert(activityLogs).values({
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
      actionType: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: "category",
      createdAt: "2026-04-29T23:59:59.999Z",
      updatedAt: "2026-04-29T23:59:59.999Z",
      metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.CREATE, after: { title: "Late log" } },
    });

    const response = await request(app.getHttpServer())
      .get("/api/activity-logs?to=2026-04-29")
      .set("Cookie", await cookieFor(admin, app))
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toHaveProperty("createdAt");
    expect(new Date(response.body.data[0].createdAt).toISOString().startsWith("2026-04-29")).toBe(
      true,
    );
  });
});
