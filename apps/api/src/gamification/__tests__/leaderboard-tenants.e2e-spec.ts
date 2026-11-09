import { randomUUID } from "node:crypto";

import { LEADERBOARD_METRICS, LEADERBOARD_PERIODS, XP_TRANSACTION_TYPES } from "@repo/shared";
import { isNull, sql } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { settings, tenants, xpTransactions } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const PASSWORD = "Password123@@";

// The proxy connects as the app role, so row-level security applies as it does in production.
describe("Leaderboard tenant isolation (e2e)", () => {
  let app: INestApplication;
  let admin: UserWithCredentials;
  let ownLearnerId: UUIDType;
  let otherLearnerId: UUIDType;
  let otherGroupId: UUIDType;

  beforeAll(async () => {
    const testContext = await createE2ETest({ useDbProxy: true });
    const db: DatabasePg = testContext.app.get(DB);
    const dbAdmin: DatabasePg = testContext.app.get(DB_ADMIN);
    const userFactory = createUserFactory(db);

    const enableLeaderboards = () =>
      db
        .update(settings)
        .set({
          settings: sql`${settings.settings} || ${JSON.stringify({
            gamificationEnabled: true,
            leaderboardsEnabled: true,
          })}::text::jsonb`,
        })
        .where(isNull(settings.userId));

    const createLearnerWithXp = async (tenantId: string, lifetimeDelta: number) => {
      const learner = await userFactory
        .withCredentials({ password: PASSWORD })
        .withUserSettings(db)
        .create({ tenantId });

      await db.insert(xpTransactions).values({
        userId: learner.id,
        type: XP_TRANSACTION_TYPES.ACHIEVEMENT_LEVEL,
        sourceId: randomUUID(),
        lifetimeDelta,
        spendableDelta: 0,
      });

      return learner;
    };

    app = testContext.app;

    admin = await testContext.runAsTenant(testContext.defaultTenantId, async () => {
      await truncateAllTables(dbAdmin, db);
      await enableLeaderboards();
      ownLearnerId = (await createLearnerWithXp(testContext.defaultTenantId, 10)).id;

      return userFactory
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({ tenantId: testContext.defaultTenantId });
    });

    const [otherTenant] = await dbAdmin
      .insert(tenants)
      .values({ name: "Other leaderboard tenant", host: `https://${randomUUID()}.example` })
      .returning();

    await testContext.runAsTenant(otherTenant.id, async () => {
      await createSettingsFactory(db).create({ userId: null });
      await enableLeaderboards();

      const otherLearner = await createLearnerWithXp(otherTenant.id, 1000);

      otherLearnerId = otherLearner.id;
      otherGroupId = (await createGroupFactory(db).withMembers([otherLearner.id]).create()).id;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("ranks only the tenant's own learners and hides other tenants' groups", async () => {
    const cookie = await cookieFor(admin, app);
    const query = { metric: LEADERBOARD_METRICS.XP, period: LEADERBOARD_PERIODS.ALL_TIME };

    const { body } = await request(app.getHttpServer())
      .get("/api/gamification/leaderboards")
      .query(query)
      .set("Cookie", cookie)
      .expect(200);
    const rankedIds = body.data.entries.map(({ userId }: { userId: UUIDType }) => userId);

    expect(rankedIds).toEqual([ownLearnerId]);
    expect(rankedIds).not.toContain(otherLearnerId);

    await request(app.getHttpServer())
      .get("/api/gamification/leaderboards")
      .query({ ...query, groupId: otherGroupId })
      .set("Cookie", cookie)
      .expect(404);

    const scopes = await request(app.getHttpServer())
      .get("/api/gamification/leaderboards/scopes?language=en")
      .set("Cookie", cookie)
      .expect(200);

    expect(scopes.body.data.groups).toEqual([]);
  });
});
