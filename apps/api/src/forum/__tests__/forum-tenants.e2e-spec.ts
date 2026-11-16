import { randomUUID } from "node:crypto";

import { DISCUSSION_SCOPES } from "@repo/shared";
import { isNull, sql } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courseChatMessages, courseChatThreads, settings, tenants } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const PASSWORD = "Password123@@";

// The proxy connects as the app role, so row-level security applies as it does in production.
describe("Forum tenant isolation (e2e)", () => {
  let app: INestApplication;
  let ownUser: UserWithCredentials;
  let ownTopicId: UUIDType;
  let otherTopicId: UUIDType;
  let otherPostId: UUIDType;

  beforeAll(async () => {
    const testContext = await createE2ETest({ useDbProxy: true });
    const db: DatabasePg = testContext.app.get(DB);
    const dbAdmin: DatabasePg = testContext.app.get(DB_ADMIN);
    const userFactory = createUserFactory(db);

    const enableForum = () =>
      db
        .update(settings)
        .set({
          settings: sql`${settings.settings} || ${JSON.stringify({ forumEnabled: true })}::text::jsonb`,
        })
        .where(isNull(settings.userId));

    const createGeneralTopic = async (userId: UUIDType, title: string) => {
      const [thread] = await db
        .insert(courseChatThreads)
        .values({ scope: DISCUSSION_SCOPES.GENERAL, title, createdByUserId: userId })
        .returning({ id: courseChatThreads.id });
      const [post] = await db
        .insert(courseChatMessages)
        .values({ threadId: thread.id, userId, content: `${title} content` })
        .returning({ id: courseChatMessages.id });

      return { topicId: thread.id, postId: post.id };
    };

    app = testContext.app;

    ownUser = await testContext.runAsTenant(testContext.defaultTenantId, async () => {
      await truncateAllTables(dbAdmin, db);
      await enableForum();

      const user = await userFactory
        .withCredentials({ password: PASSWORD })
        .withUserSettings(db)
        .create({ tenantId: testContext.defaultTenantId });

      ownTopicId = (await createGeneralTopic(user.id, "Own tenant topic")).topicId;

      return user;
    });

    const [otherTenant] = await dbAdmin
      .insert(tenants)
      .values({ name: "Other forum tenant", host: `https://${randomUUID()}.example` })
      .returning();

    await testContext.runAsTenant(otherTenant.id, async () => {
      await createSettingsFactory(db).create({ userId: null });
      await enableForum();

      const otherUser = await userFactory
        .withCredentials({ password: PASSWORD })
        .withUserSettings(db)
        .create({ tenantId: otherTenant.id });
      const otherTopic = await createGeneralTopic(otherUser.id, "Other tenant topic");

      otherTopicId = otherTopic.topicId;
      otherPostId = otherTopic.postId;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("shows and changes only the organization's own topics", async () => {
    const cookie = await cookieFor(ownUser, app);

    const { body } = await request(app.getHttpServer())
      .get("/api/forum/topics")
      .set("Cookie", cookie)
      .expect(200);

    expect(body.data.map((topic: { id: UUIDType }) => topic.id)).toEqual([ownTopicId]);
    expect(body.pagination.totalItems).toBe(1);

    await request(app.getHttpServer())
      .get(`/api/forum/topics/${otherTopicId}`)
      .set("Cookie", cookie)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/forum/topics/${otherTopicId}/posts`)
      .set("Cookie", cookie)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/forum/topics/${otherTopicId}/posts`)
      .set("Cookie", cookie)
      .send({ content: "Crossing tenants" })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/forum/posts/${otherPostId}`)
      .set("Cookie", cookie)
      .expect(404);
  });
});
