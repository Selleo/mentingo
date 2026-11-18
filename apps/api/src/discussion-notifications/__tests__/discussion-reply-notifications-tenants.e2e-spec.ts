import { randomUUID } from "node:crypto";

import { DISCUSSION_SCOPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { isNull, sql } from "drizzle-orm";

import { ForumReplyCreatedEvent } from "src/events/forum/forum-reply-created.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  courseChatMessages,
  courseChatThreads,
  discussionThreadFollowers,
  settings,
  tenants,
  userAnnouncements,
} from "src/storage/schema";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { assignSystemRoleToUserInTests } from "../../../test/helpers/permission-role-helpers";
import { truncateAllTables } from "../../../test/helpers/test-helpers";
import { dispatchOutbox } from "../../../test/helpers/wait-for-outbox";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

type TenantTopic = {
  tenantId: UUIDType;
  topicId: UUIDType;
  firstPostId: UUIDType;
  replyId: UUIDType;
  authorId: UUIDType;
  replierId: UUIDType;
};

describe("Discussion reply notifications tenant isolation (e2e)", () => {
  let app: INestApplication;
  let dbAdmin: DatabasePg;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  let ownTopic: TenantTopic;
  let otherTopic: TenantTopic;

  const publishReplyTo = (topic: TenantTopic, publishingTenant: TenantTopic) =>
    runAsTenant(publishingTenant.tenantId, () =>
      app.get(OutboxPublisher).publish(
        new ForumReplyCreatedEvent({
          topicId: topic.topicId,
          postId: topic.replyId,
          firstPostId: topic.firstPostId,
          actorUserId: publishingTenant.replierId,
          mentionedUserIds: [],
        }),
      ),
    );

  const findNotifiedUsers = () =>
    dbAdmin
      .select({ userId: userAnnouncements.userId, tenantId: userAnnouncements.tenantId })
      .from(userAnnouncements);

  beforeAll(async () => {
    const testContext = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: REALTIME_PUBLISHER, useValue: { emitToRoom: jest.fn() } }],
    });
    const db: DatabasePg = testContext.app.get(DB);
    const userFactory = createUserFactory(db);

    app = testContext.app;
    dbAdmin = testContext.app.get(DB_ADMIN);
    runAsTenant = testContext.runAsTenant;

    const createForumUser = async (tenantId: UUIDType) => {
      const user = await userFactory.withUserSettings(db).create({ tenantId });
      await assignSystemRoleToUserInTests(db, user.id, tenantId, SYSTEM_ROLE_SLUGS.STUDENT);

      return user.id;
    };

    const createTenantTopic = async (tenantId: UUIDType): Promise<TenantTopic> => {
      await db
        .update(settings)
        .set({
          settings: sql`${settings.settings} || ${JSON.stringify({
            forumEnabled: true,
          })}::text::jsonb`,
        })
        .where(isNull(settings.userId));

      const authorId = await createForumUser(tenantId);
      const replierId = await createForumUser(tenantId);
      const [thread] = await db
        .insert(courseChatThreads)
        .values({ scope: DISCUSSION_SCOPES.GENERAL, title: "Topic", createdByUserId: authorId })
        .returning({ id: courseChatThreads.id });
      const [firstPost] = await db
        .insert(courseChatMessages)
        .values({ threadId: thread.id, userId: authorId, content: "First post" })
        .returning({ id: courseChatMessages.id });
      await db.insert(discussionThreadFollowers).values({ threadId: thread.id, userId: authorId });

      const [reply] = await db
        .insert(courseChatMessages)
        .values({
          threadId: thread.id,
          userId: replierId,
          content: "A reply",
          parentMessageId: firstPost.id,
        })
        .returning({ id: courseChatMessages.id });

      return {
        tenantId,
        topicId: thread.id,
        firstPostId: firstPost.id,
        replyId: reply.id,
        authorId,
        replierId,
      };
    };

    ownTopic = await runAsTenant(testContext.defaultTenantId, async () => {
      await truncateAllTables(dbAdmin, db);

      return createTenantTopic(testContext.defaultTenantId);
    });

    const [otherTenant] = await dbAdmin
      .insert(tenants)
      .values({ name: "Other forum tenant", host: `https://${randomUUID()}.example` })
      .returning();

    otherTopic = await runAsTenant(otherTenant.id, async () => {
      await createSettingsFactory(db).create({ userId: null });

      return createTenantTopic(otherTenant.id);
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("notifies nobody when a reply event names another organization's topic", async () => {
    await publishReplyTo(otherTopic, ownTopic);

    await dispatchOutbox(app);

    expect(await findNotifiedUsers()).toEqual([]);
  });

  it("notifies the topic author inside the organization the reply belongs to", async () => {
    await publishReplyTo(otherTopic, otherTopic);

    await dispatchOutbox(app);

    expect(await findNotifiedUsers()).toEqual([
      { userId: otherTopic.authorId, tenantId: otherTopic.tenantId },
    ]);
  });
});
