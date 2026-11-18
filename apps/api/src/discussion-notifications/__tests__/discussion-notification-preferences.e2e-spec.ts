import { JwtService } from "@nestjs/jwt";
import {
  COURSE_ENROLLMENT,
  DISCUSSION_NOTIFICATION_PREFERENCES,
  DISCUSSION_UNSUBSCRIBE_PATH,
  DISCUSSION_UNSUBSCRIBE_TYPES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { addMinutes } from "date-fns";
import { isNull, sql } from "drizzle-orm";
import request from "supertest";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import {
  DISCUSSION_REPLY_DIGEST_DELAY_MINUTES,
  DISCUSSION_UNSUBSCRIBE_TOKEN_PURPOSE,
} from "src/discussion-notifications/discussion-notifications.constants";
import { DiscussionReplyDigestService } from "src/discussion-notifications/discussion-reply-digest.service";
import { DiscussionUnsubscribeTokenService } from "src/discussion-notifications/discussion-unsubscribe-token.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { settings, studentCourses } from "src/storage/schema";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { deliverPendingAutomationEmails } from "../../../test/helpers/automation-emails";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";
import { dispatchOutbox } from "../../../test/helpers/wait-for-outbox";

import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type { INestApplication } from "@nestjs/common";
import type { DiscussionNotificationPreference, DiscussionUnsubscribeType } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";

type Participant = { user: UserWithCredentials; cookie: string };

const REPLY_EMAIL_SUBJECT = "New replies in";
const MENTION_EMAIL_SUBJECT = "You were mentioned in";

describe("Discussion notification preferences, following and unsubscribing (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let defaultTenantId: UUIDType;
  let runAsTenant: <T>(tenantId: UUIDType, callback: () => Promise<T>) => Promise<T>;
  let emailAdapter: EmailTestingAdapter;

  const password = "Password123!";

  const createStudents = (count: number) =>
    runAsTenant(defaultTenantId, async () => {
      const students: Participant[] = [];

      for (let index = 0; index < count; index++) {
        const user = await createUserFactory(db)
          .withCredentials({ password })
          .create({ roleSlug: SYSTEM_ROLE_SLUGS.STUDENT, tenantId: defaultTenantId });
        await createSettingsFactory(db, user.id).create();
        students.push({ user, cookie: await cookieFor(user, app) });
      }

      return students;
    });

  const fullNameOf = ({ user }: Participant) => `${user.firstName} ${user.lastName}`;

  const createTopic = async (author: Participant, title: string) => {
    const response = await request(app.getHttpServer())
      .post("/api/forum/topics")
      .set("Cookie", author.cookie)
      .send({ title, content: `${title} first post` })
      .expect(201);

    return response.body.data as { id: string; isFollowing: boolean };
  };

  const getTopic = async (participant: Participant, topicId: string) => {
    const response = await request(app.getHttpServer())
      .get(`/api/forum/topics/${topicId}`)
      .set("Cookie", participant.cookie)
      .expect(200);

    return response.body.data as { id: string; isFollowing: boolean };
  };

  const replyInTopic = async (
    participant: Participant,
    topicId: string,
    body: { content: string; mentionedUserIds?: string[] },
  ) => {
    await request(app.getHttpServer())
      .post(`/api/forum/topics/${topicId}/posts`)
      .set("Cookie", participant.cookie)
      .send(body)
      .expect(201);
  };

  const setPreference = (
    participant: Participant,
    preference: DiscussionNotificationPreference,
    enabled: boolean,
  ) =>
    request(app.getHttpServer())
      .patch("/api/settings/notifications")
      .set("Cookie", participant.cookie)
      .send({ [preference]: enabled })
      .expect(200);

  const getPreference = async (
    participant: Participant,
    preference: DiscussionNotificationPreference,
  ) => {
    const response = await request(app.getHttpServer())
      .get("/api/settings")
      .set("Cookie", participant.cookie)
      .expect(200);

    return response.body.data[preference] as boolean | undefined;
  };

  const countNotifications = async (participant: Participant) => {
    const response = await request(app.getHttpServer())
      .get("/api/announcements/user/me")
      .query({ language: "en" })
      .set("Cookie", participant.cookie)
      .expect(200);

    return (response.body.data as unknown[]).length;
  };

  const sendEmailsDueAfterTheDelay = async () => {
    await dispatchOutbox(app);
    await runAsTenant(defaultTenantId, () =>
      app
        .get(DiscussionReplyDigestService)
        .sendDueDigests(addMinutes(new Date(), DISCUSSION_REPLY_DIGEST_DELAY_MINUTES + 1)),
    );
    await deliverPendingAutomationEmails(app, defaultTenantId);
  };

  const emailsTo = ({ user }: Participant, subjectStart: string) =>
    emailAdapter
      .getAllEmails()
      .filter((email) => email.to === user.email && email.subject.startsWith(subjectStart));

  const unsubscribeTokensIn = (email: { html?: string }) =>
    [...(email.html ?? "").matchAll(/notifications\/unsubscribe\?token=([^"&\s]+)/g)].map(
      ([, token]) => decodeURIComponent(token),
    );

  const unsubscribe = (token: string) =>
    request(app.getHttpServer()).post("/api/discussion-notifications/unsubscribe").send({ token });

  beforeAll(async () => {
    const context = await createE2ETest({
      useDbProxy: true,
      manualAutomationEmails: true,
      customProviders: [{ provide: REALTIME_PUBLISHER, useValue: { emitToRoom: jest.fn() } }],
    });
    app = context.app;
    defaultTenantId = context.defaultTenantId;
    runAsTenant = context.runAsTenant;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    emailAdapter = app.get(EmailAdapter) as EmailTestingAdapter;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await runAsTenant(defaultTenantId, async () => {
      await truncateAllTables(dbAdmin, db);
      await db
        .update(settings)
        .set({
          settings: sql`${settings.settings} || ${JSON.stringify({
            forumEnabled: true,
            courseDiscussionsEnabled: true,
          })}::text::jsonb`,
        })
        .where(isNull(settings.userId));
    });
    emailAdapter.clearEmails();
  });

  describe("preferences", () => {
    it("stops notifications in the application but keeps the email", async () => {
      const [topicAuthor, replier] = await createStudents(2);
      const topic = await createTopic(topicAuthor, "Release notes");
      await setPreference(topicAuthor, DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_IN_APP, false);

      await replyInTopic(replier, topic.id, { content: "First answer" });
      await sendEmailsDueAfterTheDelay();

      expect(await countNotifications(topicAuthor)).toBe(0);
      expect(emailsTo(topicAuthor, REPLY_EMAIL_SUBJECT)).toHaveLength(1);
      expect(emailsTo(topicAuthor, REPLY_EMAIL_SUBJECT)[0].text).toContain(
        `New replies: 1. From: ${fullNameOf(replier)}.`,
      );
    });

    it("stops reply emails but keeps the notification in the application", async () => {
      const [topicAuthor, replier] = await createStudents(2);
      const topic = await createTopic(topicAuthor, "Release notes");
      await setPreference(topicAuthor, DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_EMAILS, false);

      await replyInTopic(replier, topic.id, { content: "First answer" });
      await sendEmailsDueAfterTheDelay();

      expect(await countNotifications(topicAuthor)).toBe(1);
      expect(emailsTo(topicAuthor, REPLY_EMAIL_SUBJECT)).toEqual([]);
    });

    it("sends no reply email when it was switched off while the email was waiting", async () => {
      const [topicAuthor, replier] = await createStudents(2);
      const topic = await createTopic(topicAuthor, "Release notes");
      await replyInTopic(replier, topic.id, { content: "First answer" });
      await dispatchOutbox(app);
      await setPreference(topicAuthor, DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_EMAILS, false);

      await sendEmailsDueAfterTheDelay();

      expect(emailsTo(topicAuthor, REPLY_EMAIL_SUBJECT)).toEqual([]);
    });

    it("stops mention emails but keeps the mention notification", async () => {
      const [topicAuthor, replier] = await createStudents(2);
      const topic = await createTopic(topicAuthor, "Release notes");
      await setPreference(topicAuthor, DISCUSSION_NOTIFICATION_PREFERENCES.MENTION_EMAILS, false);

      await replyInTopic(replier, topic.id, {
        content: `@${fullNameOf(topicAuthor)} please check`,
        mentionedUserIds: [topicAuthor.user.id],
      });
      await sendEmailsDueAfterTheDelay();

      expect(await countNotifications(topicAuthor)).toBe(1);
      expect(emailsTo(topicAuthor, MENTION_EMAIL_SUBJECT)).toEqual([]);
    });

    it("rejects a preference it does not know", async () => {
      const [student] = await createStudents(1);

      await request(app.getHttpServer())
        .patch("/api/settings/notifications")
        .set("Cookie", student.cookie)
        .send({ language: "pl" })
        .expect(400);
    });
  });

  describe("following", () => {
    it("notifies a reader who follows a topic without having posted in it", async () => {
      const [topicAuthor, reader, replier] = await createStudents(3);
      const topic = await createTopic(topicAuthor, "Release notes");
      expect((await getTopic(reader, topic.id)).isFollowing).toBe(false);

      await request(app.getHttpServer())
        .put(`/api/forum/topics/${topic.id}/follow`)
        .set("Cookie", reader.cookie)
        .expect(200);
      await replyInTopic(replier, topic.id, { content: "First answer" });
      await sendEmailsDueAfterTheDelay();

      expect((await getTopic(reader, topic.id)).isFollowing).toBe(true);
      expect(await countNotifications(reader)).toBe(1);
      expect(emailsTo(reader, REPLY_EMAIL_SUBJECT)).toHaveLength(1);
    });

    it("stops notifying an author who unfollowed, until they reply again", async () => {
      const [topicAuthor, replier] = await createStudents(2);
      const topic = await createTopic(topicAuthor, "Release notes");
      expect(topic.isFollowing).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/forum/topics/${topic.id}/follow`)
        .set("Cookie", topicAuthor.cookie)
        .expect(200);
      await replyInTopic(replier, topic.id, { content: "First answer" });
      await sendEmailsDueAfterTheDelay();

      expect(await countNotifications(topicAuthor)).toBe(0);
      expect(emailsTo(topicAuthor, REPLY_EMAIL_SUBJECT)).toEqual([]);

      await replyInTopic(topicAuthor, topic.id, { content: "Thanks" });
      await replyInTopic(replier, topic.id, { content: "You are welcome" });
      await sendEmailsDueAfterTheDelay();

      expect((await getTopic(topicAuthor, topic.id)).isFollowing).toBe(true);
      expect(await countNotifications(topicAuthor)).toBe(1);
    });

    it("lets an enrolled learner follow and unfollow a course thread", async () => {
      const [threadAuthor, reader, outsider] = await createStudents(3);
      const course = await runAsTenant(defaultTenantId, async () => {
        const category = await createCategoryFactory(db).create();
        const createdCourse = await createCourseFactory(db).create({
          authorId: threadAuthor.user.id,
          categoryId: category.id,
          status: "published",
        });
        await db.insert(studentCourses).values(
          [threadAuthor, reader].map(({ user }) => ({
            studentId: user.id,
            courseId: createdCourse.id,
            status: COURSE_ENROLLMENT.ENROLLED,
          })),
        );

        return createdCourse;
      });
      const threadResponse = await request(app.getHttpServer())
        .post(`/api/course-chat/${course.id}/messages`)
        .set("Cookie", threadAuthor.cookie)
        .send({ content: "A question" })
        .expect(201);
      const threadMessageId = threadResponse.body.data.id as string;
      const isFollowedBy = async (participant: Participant) => {
        const response = await request(app.getHttpServer())
          .get(`/api/course-chat/${course.id}/messages`)
          .set("Cookie", participant.cookie)
          .expect(200);

        return response.body.data[0].isFollowing as boolean;
      };

      expect(threadResponse.body.data.isFollowing).toBe(true);
      expect(await isFollowedBy(reader)).toBe(false);

      await request(app.getHttpServer())
        .put(`/api/course-chat/messages/${threadMessageId}/follow`)
        .set("Cookie", reader.cookie)
        .expect(200);
      expect(await isFollowedBy(reader)).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${threadMessageId}/follow`)
        .set("Cookie", reader.cookie)
        .expect(200);
      expect(await isFollowedBy(reader)).toBe(false);

      await request(app.getHttpServer())
        .put(`/api/course-chat/messages/${threadMessageId}/follow`)
        .set("Cookie", outsider.cookie)
        .expect(403);
    });
  });

  describe("unsubscribe links", () => {
    it("puts a stop-following link and a turn-off link in the reply email, each doing its job", async () => {
      const [topicAuthor, replier] = await createStudents(2);
      const topic = await createTopic(topicAuthor, "Release notes");
      await replyInTopic(replier, topic.id, { content: "First answer" });
      await sendEmailsDueAfterTheDelay();

      const [replyEmail] = emailsTo(topicAuthor, REPLY_EMAIL_SUBJECT);
      const [unfollowToken, unsubscribeToken] = unsubscribeTokensIn(replyEmail);
      expect(replyEmail.html).toContain(`https://tenant.local${DISCUSSION_UNSUBSCRIBE_PATH}`);
      expect(replyEmail.text).toContain("Stop following this discussion");
      expect(replyEmail.text).toContain("Turn off emails about replies");

      const unfollowed = await unsubscribe(unfollowToken).expect(201);
      expect(unfollowed.body.data).toEqual({ type: DISCUSSION_UNSUBSCRIBE_TYPES.THREAD });
      expect((await getTopic(topicAuthor, topic.id)).isFollowing).toBe(false);
      expect(
        await getPreference(topicAuthor, DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_EMAILS),
      ).not.toBe(false);

      const unsubscribed = await unsubscribe(unsubscribeToken).expect(201);
      expect(unsubscribed.body.data).toEqual({ type: DISCUSSION_UNSUBSCRIBE_TYPES.REPLIES });
      expect(
        await getPreference(topicAuthor, DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_EMAILS),
      ).toBe(false);
    });

    it("turns mention emails off from the link in a mention email", async () => {
      const [topicAuthor, replier] = await createStudents(2);
      const topic = await createTopic(topicAuthor, "Release notes");
      await replyInTopic(replier, topic.id, {
        content: `@${fullNameOf(topicAuthor)} please check`,
        mentionedUserIds: [topicAuthor.user.id],
      });
      await dispatchOutbox(app);
      await deliverPendingAutomationEmails(app, defaultTenantId);

      const [mentionEmail] = emailsTo(topicAuthor, MENTION_EMAIL_SUBJECT);
      const [unsubscribeToken] = unsubscribeTokensIn(mentionEmail);
      expect(mentionEmail.text).toContain("Turn off emails about mentions");

      const unsubscribed = await unsubscribe(unsubscribeToken).expect(201);
      expect(unsubscribed.body.data).toEqual({ type: DISCUSSION_UNSUBSCRIBE_TYPES.MENTIONS });
      expect(
        await getPreference(topicAuthor, DISCUSSION_NOTIFICATION_PREFERENCES.MENTION_EMAILS),
      ).toBe(false);
    });

    it("rejects a changed, expired or foreign link and changes nothing", async () => {
      const [student] = await createStudents(1);
      const claims = {
        tenantId: defaultTenantId,
        userId: student.user.id,
        type: DISCUSSION_UNSUBSCRIBE_TYPES.REPLIES as DiscussionUnsubscribeType,
      };
      const tokenService = app.get(DiscussionUnsubscribeTokenService);
      const validToken = await tokenService.sign(claims);
      const expiredToken = await app
        .get(JwtService)
        .signAsync(
          { ...claims, purpose: DISCUSSION_UNSUBSCRIBE_TOKEN_PURPOSE },
          { expiresIn: -60 },
        );
      const otherPurposeToken = await app
        .get(JwtService)
        .signAsync({ ...claims, purpose: "other" });
      const otherTenantToken = await tokenService.sign({
        ...claims,
        tenantId: "00000000-0000-4000-8000-000000000001",
      });

      for (const token of [
        `${validToken}x`,
        expiredToken,
        otherPurposeToken,
        otherTenantToken,
        "not-a-token",
      ]) {
        await unsubscribe(token).expect(400);
      }

      expect(
        await getPreference(student, DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_EMAILS),
      ).not.toBe(false);
    });
  });
});
