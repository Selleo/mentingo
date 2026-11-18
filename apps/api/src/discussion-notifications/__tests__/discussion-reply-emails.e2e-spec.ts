import { COURSE_ENROLLMENT, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { addMinutes } from "date-fns";
import { and, eq, isNull, sql } from "drizzle-orm";
import request from "supertest";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { DISCUSSION_REPLY_DIGEST_DELAY_MINUTES } from "src/discussion-notifications/discussion-notifications.constants";
import { DiscussionNotificationsRepository } from "src/discussion-notifications/discussion-notifications.repository";
import { DiscussionReplyDigestService } from "src/discussion-notifications/discussion-reply-digest.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { discussionReplyDigests, settings, studentCourses } from "src/storage/schema";
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
import type { DatabasePg, UUIDType } from "src/common";

type Participant = { user: UserWithCredentials; cookie: string };

describe("Discussion reply emails (e2e)", () => {
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

    return response.body.data as { id: string };
  };

  const replyInTopic = async (
    participant: Participant,
    topicId: string,
    body: { content: string; mentionedUserIds?: string[] },
  ) => {
    const response = await request(app.getHttpServer())
      .post(`/api/forum/topics/${topicId}/posts`)
      .set("Cookie", participant.cookie)
      .send(body)
      .expect(201);

    return response.body.data as { id: string };
  };

  const postCourseMessage = async (
    participant: Participant,
    courseId: string,
    body: { content: string; parentMessageId?: string },
  ) => {
    const response = await request(app.getHttpServer())
      .post(`/api/course-chat/${courseId}/messages`)
      .set("Cookie", participant.cookie)
      .send(body)
      .expect(201);

    return response.body.data as { id: string };
  };

  const sendEmailsDueAfterTheDelay = async (from = new Date()) => {
    await dispatchOutbox(app);
    await runAsTenant(defaultTenantId, () =>
      app
        .get(DiscussionReplyDigestService)
        .sendDueDigests(addMinutes(from, DISCUSSION_REPLY_DIGEST_DELAY_MINUTES + 1)),
    );
    await deliverPendingAutomationEmails(app, defaultTenantId);
  };

  const emailsTo = ({ user }: Participant) =>
    emailAdapter.getAllEmails().filter((email) => email.to === user.email);

  const textOf = (email: { text?: string }) => email.text?.replace(/\s+/g, " ") ?? "";

  const countPendingEmails = async () => {
    const [{ pending }] = await dbAdmin
      .select({ pending: sql<number>`count(*)::int` })
      .from(discussionReplyDigests);

    return pending;
  };

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

  it("groups the replies of a topic into one email per participant, sent after the delay", async () => {
    const [topicAuthor, firstReplier, secondReplier] = await createStudents(3);
    const topic = await createTopic(topicAuthor, "Release notes");
    await replyInTopic(firstReplier, topic.id, { content: "First answer" });
    await replyInTopic(firstReplier, topic.id, { content: "One more thing" });
    await replyInTopic(secondReplier, topic.id, { content: "The latest answer" });

    await dispatchOutbox(app);
    await runAsTenant(defaultTenantId, () =>
      app.get(DiscussionReplyDigestService).sendDueDigests(),
    );
    await deliverPendingAutomationEmails(app, defaultTenantId);
    expect(emailAdapter.getAllEmails()).toEqual([]);

    await sendEmailsDueAfterTheDelay();

    const [emailToAuthor] = emailsTo(topicAuthor);
    expect(emailsTo(topicAuthor)).toHaveLength(1);
    expect(emailToAuthor.subject).toBe("New replies in Release notes");
    expect(textOf(emailToAuthor)).toContain(
      `New replies: 3. From: ${fullNameOf(firstReplier)}, ${fullNameOf(secondReplier)}.`,
    );
    expect(textOf(emailToAuthor)).toContain("Latest reply: The latest answer");
    expect(emailToAuthor.html).toContain(`/forum/topics/${topic.id}`);
    expect(emailsTo(firstReplier)).toHaveLength(1);
    expect(textOf(emailsTo(firstReplier)[0])).toContain(
      `New replies: 1. From: ${fullNameOf(secondReplier)}.`,
    );
    expect(emailsTo(secondReplier)).toEqual([]);
    expect(await countPendingEmails()).toBe(0);
  });

  it("sends nothing to a participant who read the notifications, and starts over for later replies", async () => {
    const [topicAuthor, replier] = await createStudents(2);
    const topic = await createTopic(topicAuthor, "Release notes");
    await replyInTopic(replier, topic.id, { content: "First answer" });
    await dispatchOutbox(app);
    await request(app.getHttpServer())
      .patch("/api/announcements/read-all")
      .set("Cookie", topicAuthor.cookie)
      .expect(200);

    await sendEmailsDueAfterTheDelay();

    expect(emailAdapter.getAllEmails()).toEqual([]);
    expect(await countPendingEmails()).toBe(0);

    await replyInTopic(replier, topic.id, { content: "A later answer" });
    await sendEmailsDueAfterTheDelay();

    expect(emailsTo(topicAuthor)).toHaveLength(1);
    expect(textOf(emailsTo(topicAuthor)[0])).toContain("New replies: 1.");
    expect(textOf(emailsTo(topicAuthor)[0])).toContain("Latest reply: A later answer");
  });

  it("describes only the replies the email counts", async () => {
    const [topicAuthor, firstReplier, secondReplier, mentioningReplier] = await createStudents(4);
    const topic = await createTopic(topicAuthor, "Release notes");
    await replyInTopic(firstReplier, topic.id, { content: "The counted answer" });
    const deletedReply = await replyInTopic(secondReplier, topic.id, {
      content: "A withdrawn answer",
    });
    await replyInTopic(mentioningReplier, topic.id, {
      content: `@${fullNameOf(topicAuthor)} a mention`,
      mentionedUserIds: [topicAuthor.user.id],
    });
    await dispatchOutbox(app);
    await request(app.getHttpServer())
      .delete(`/api/forum/posts/${deletedReply.id}`)
      .set("Cookie", secondReplier.cookie)
      .expect(200);

    await sendEmailsDueAfterTheDelay();

    const replyEmails = emailsTo(topicAuthor).filter(({ subject }) =>
      subject.startsWith("New replies in"),
    );
    const [emailToAuthor] = replyEmails;
    expect(replyEmails).toHaveLength(1);
    expect(textOf(emailToAuthor)).toContain(`New replies: 1. From: ${fullNameOf(firstReplier)}.`);
    expect(textOf(emailToAuthor)).toContain("Latest reply: The counted answer");
  });

  it("emails a participant who has no saved settings, in English", async () => {
    const [topicAuthor, replier] = await createStudents(2);
    const topic = await createTopic(topicAuthor, "Release notes");
    await replyInTopic(replier, topic.id, { content: "First answer" });
    await runAsTenant(defaultTenantId, () =>
      db.delete(settings).where(eq(settings.userId, topicAuthor.user.id)),
    );

    await sendEmailsDueAfterTheDelay();

    expect(emailsTo(topicAuthor)).toHaveLength(1);
    expect(emailsTo(topicAuthor)[0].subject).toBe("New replies in Release notes");
  });

  it("sends the other emails when one fails, and retries the failed one later", async () => {
    const [firstAuthor, secondAuthor, replier] = await createStudents(3);
    const firstTopic = await createTopic(firstAuthor, "Release notes");
    const secondTopic = await createTopic(secondAuthor, "Roadmap");
    await replyInTopic(replier, firstTopic.id, { content: "First answer" });
    await replyInTopic(replier, secondTopic.id, { content: "Second answer" });
    const threadLookup = jest
      .spyOn(app.get(DiscussionNotificationsRepository), "findDigestThread")
      .mockRejectedValueOnce(new Error("Thread lookup failed"));

    await sendEmailsDueAfterTheDelay();

    expect(emailAdapter.getAllEmails()).toHaveLength(1);
    expect(await countPendingEmails()).toBe(1);

    await sendEmailsDueAfterTheDelay(addMinutes(new Date(), DISCUSSION_REPLY_DIGEST_DELAY_MINUTES));

    expect(emailsTo(firstAuthor)).toHaveLength(1);
    expect(emailsTo(secondAuthor)).toHaveLength(1);
    expect(await countPendingEmails()).toBe(0);
    threadLookup.mockRestore();
  });

  it("links a course thread and skips participants who left the course", async () => {
    const [threadAuthor, formerStudent, replier] = await createStudents(3);
    const course = await runAsTenant(defaultTenantId, async () => {
      const category = await createCategoryFactory(db).create();
      const createdCourse = await createCourseFactory(db).create({
        authorId: threadAuthor.user.id,
        categoryId: category.id,
        title: "Negotiation basics",
        status: "published",
      });
      await db.insert(studentCourses).values(
        [threadAuthor, formerStudent, replier].map(({ user }) => ({
          studentId: user.id,
          courseId: createdCourse.id,
          status: COURSE_ENROLLMENT.ENROLLED,
        })),
      );

      return createdCourse;
    });
    const thread = await postCourseMessage(threadAuthor, course.id, { content: "A question" });
    await postCourseMessage(formerStudent, course.id, {
      content: "An answer",
      parentMessageId: thread.id,
    });
    await postCourseMessage(replier, course.id, {
      content: "A better answer",
      parentMessageId: thread.id,
    });
    await dispatchOutbox(app);
    await runAsTenant(defaultTenantId, () =>
      db
        .update(studentCourses)
        .set({ status: COURSE_ENROLLMENT.NOT_ENROLLED })
        .where(
          and(
            eq(studentCourses.courseId, course.id),
            eq(studentCourses.studentId, formerStudent.user.id),
          ),
        ),
    );

    await sendEmailsDueAfterTheDelay();

    const [emailToAuthor] = emailsTo(threadAuthor);
    expect(emailsTo(threadAuthor)).toHaveLength(1);
    expect(emailToAuthor.subject).toBe("New replies in Negotiation basics");
    expect(textOf(emailToAuthor)).toContain("New replies: 2.");
    expect(emailToAuthor.html).toContain(`/course/${course.id}?tab=Discussion`);
    expect(emailToAuthor.html).toContain(`thread=${thread.id}`);
    expect(emailsTo(formerStudent)).toEqual([]);
  });

  it("emails a forum mention at once and leaves that reply out of the grouped email", async () => {
    const [topicAuthor, replier] = await createStudents(2);
    const topic = await createTopic(topicAuthor, "Release notes");
    const mention = `@${fullNameOf(topicAuthor)} please check`;

    await replyInTopic(replier, topic.id, {
      content: mention,
      mentionedUserIds: [topicAuthor.user.id],
    });
    await deliverPendingAutomationEmails(app, defaultTenantId);

    const [mentionEmail] = emailsTo(topicAuthor);
    expect(emailsTo(topicAuthor)).toHaveLength(1);
    expect(mentionEmail.subject).toBe("You were mentioned in Release notes");
    expect(textOf(mentionEmail)).toContain(`${fullNameOf(replier)} mentioned you`);
    expect(textOf(mentionEmail)).toContain(mention);
    expect(mentionEmail.html).toContain(`/forum/topics/${topic.id}`);

    await sendEmailsDueAfterTheDelay();

    expect(emailsTo(topicAuthor)).toHaveLength(1);
  });
});
