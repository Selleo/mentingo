import { randomUUID } from "node:crypto";

import {
  ACHIEVEMENT_ICONS,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  ACHIEVEMENT_VISIBILITY,
  GAMIFICATION_EVENT_TYPES,
} from "@repo/shared";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { tenants } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { UpsertAchievementBody } from "src/gamification/schemas/achievement-admin.schema";

const PASSWORD = "Password123@@";
const ADMIN_ACHIEVEMENTS_URL = "/api/gamification/admin/achievements";

const achievementBody: UpsertAchievementBody = {
  title: { en: "Quiz fan" },
  description: {},
  baseLanguage: "en",
  eventType: GAMIFICATION_EVENT_TYPES.QUIZ_COMPLETED,
  requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.COUNT,
  windowDays: null,
  filters: {},
  visibility: ACHIEVEMENT_VISIBILITY.VISIBLE,
  isEnabled: true,
  icon: ACHIEVEMENT_ICONS.TARGET,
  levels: [{ threshold: 2, xpReward: 40, badgeImageKey: null }],
};

// The proxy connects as the app role, so row-level security applies as it does in production.
describe("Achievement admin tenant isolation (e2e)", () => {
  let app: INestApplication;
  let admin: UserWithCredentials;
  let otherTenantHost: string;
  let otherAdminCookie: string;

  beforeAll(async () => {
    const testContext = await createE2ETest({ useDbProxy: true });
    const db: DatabasePg = testContext.app.get(DB);
    const dbAdmin: DatabasePg = testContext.app.get(DB_ADMIN);

    app = testContext.app;
    otherTenantHost = `https://${randomUUID()}.example`;

    admin = await testContext.runAsTenant(testContext.defaultTenantId, () =>
      createUserFactory(db)
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({ tenantId: testContext.defaultTenantId }),
    );

    const [otherTenant] = await dbAdmin
      .insert(tenants)
      .values({ name: "Other gamification tenant", host: otherTenantHost })
      .returning();
    const otherAdmin = await testContext.runAsTenant(otherTenant.id, async () => {
      await createSettingsFactory(db).create({ userId: null });

      return createUserFactory(db)
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({ tenantId: otherTenant.id });
    });

    otherAdminCookie = await cookieFor(otherAdmin, app, otherTenantHost);
  });

  afterAll(async () => {
    await app.close();
  });

  it("hides an achievement from admins of other tenants", async () => {
    const server = app.getHttpServer();
    const adminCookie = await cookieFor(admin, app);
    const { body } = await request(server)
      .post(ADMIN_ACHIEVEMENTS_URL)
      .set("Cookie", adminCookie)
      .send(achievementBody)
      .expect(201);
    const url = `${ADMIN_ACHIEVEMENTS_URL}/${body.data.id}`;
    const asOtherAdmin = (pending: request.Test) =>
      pending.set("Referer", `${otherTenantHost}/`).set("Cookie", otherAdminCookie);

    const list = await asOtherAdmin(
      request(server).get(`${ADMIN_ACHIEVEMENTS_URL}?language=en`),
    ).expect(200);

    expect(list.body.data.map(({ id }: { id: UUIDType }) => id)).not.toContain(body.data.id);

    await asOtherAdmin(request(server).get(`${url}?language=en`)).expect(404);
    await asOtherAdmin(request(server).put(url).send(achievementBody)).expect(404);
    await asOtherAdmin(request(server).patch(`${url}/status`).send({ isEnabled: false })).expect(
      404,
    );

    const details = await request(server)
      .get(`${url}?language=en`)
      .set("Cookie", adminCookie)
      .expect(200);

    expect(details.body.data).toMatchObject({ isEnabled: true, title: { en: "Quiz fan" } });
  });
});
