import { faker } from "@faker-js/faker";
import {
  ANNOUNCEMENT_SOURCE_TYPES,
  COURSE_ENROLLMENT,
  NOTIFICATION_SOCKET_EVENTS,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import request from "supertest";

import { ForumReplyCreatedEvent } from "src/events/forum/forum-reply-created.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  courseChatMessages,
  outboxEvents,
  settings,
  studentCourses,
  userAnnouncements,
  users,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../test/helpers/e2e-settings";
import { assignSystemRoleToUserInTests } from "../../../test/helpers/permission-role-helpers";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";
import { dispatchOutbox } from "../../../test/helpers/wait-for-outbox";

import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

type UserNotification = {
  title: string;
  content: string;
  sourceType: string;
  sourceId: string | null;
  linkPath: string | null;
  authorId: string;
  isRead: boolean;
};

type Participant = { user: UserWithCredentials; cookie: string };

describe("Discussion reply notifications (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;
  const emitToRoom = jest.fn();

  const password = "Password123!";

  const createStudent = async (): Promise<Participant> => {
    const user = await userFactory
      .withCredentials({ password })
      .withUserSettings(db)
      .create({ roleSlug: SYSTEM_ROLE_SLUGS.STUDENT, email: faker.internet.email() });
    await assignSystemRoleToUserInTests(db, user.id, user.tenantId, SYSTEM_ROLE_SLUGS.STUDENT);

    return { user, cookie: await cookieFor(user, app) };
  };

  const createStudents = async (count: number) => {
    const students: Participant[] = [];

    for (let index = 0; index < count; index++) {
      students.push(await createStudent());
    }

    return students;
  };

  const fullNameOf = ({ user }: Participant) => `${user.firstName} ${user.lastName}`;

  const createEnrolledCourse = async (author: Participant, ...students: Participant[]) => {
    const course = await courseFactory.create({ authorId: author.user.id });
    await db
      .insert(studentCourses)
      .values(students.map(({ user }) => ({ courseId: course.id, studentId: user.id })));

    return course;
  };

  const postCourseMessage = async (
    participant: Participant,
    courseId: string,
    body: { content: string; parentMessageId?: string; mentionedUserIds?: string[] },
  ) => {
    const response = await request(app.getHttpServer())
      .post(`/api/course-chat/${courseId}/messages`)
      .set("Cookie", participant.cookie)
      .send(body)
      .expect(201);

    return response.body.data as { id: string };
  };

  const createTopic = async (participant: Participant, title: string) => {
    const response = await request(app.getHttpServer())
      .post("/api/forum/topics")
      .set("Cookie", participant.cookie)
      .send({ title, content: `${title} first post` })
      .expect(201);

    return response.body.data as { id: string; firstPost: { id: string } };
  };

  const postForumReply = async (
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

  const getNotifications = async ({ cookie }: Participant) => {
    const response = await request(app.getHttpServer())
      .get("/api/announcements/user/me")
      .query({ language: "en" })
      .set("Cookie", cookie)
      .expect(200);

    return response.body.data as UserNotification[];
  };

  const getUnreadCount = async ({ cookie }: Participant) => {
    const response = await request(app.getHttpServer())
      .get("/api/announcements/unread")
      .set("Cookie", cookie)
      .expect(200);

    return response.body.data.unreadCount as number;
  };

  const countNotificationsOf = async ({ user }: Participant) => {
    const [{ notifications }] = await db
      .select({ notifications: count() })
      .from(userAnnouncements)
      .where(eq(userAnnouncements.userId, user.id));

    return notifications;
  };

  const replyTitleFrom = (participant: Participant) =>
    `${fullNameOf(participant)} replied in a discussion you take part in`;

  const notifiedUserRooms = () =>
    emitToRoom.mock.calls
      .filter(([event]) => event === NOTIFICATION_SOCKET_EVENTS.CREATED)
      .map(([, room]) => room)
      .sort();

  const userRoomsOf = (...participants: Participant[]) =>
    participants.map(({ user }) => `user:${user.id}`).sort();

  beforeAll(async () => {
    const testContext = await createE2ETest({
      customProviders: [{ provide: REALTIME_PUBLISHER, useValue: { emitToRoom } }],
    });
    app = testContext.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    courseFactory = createCourseFactory(db);
    userFactory = createUserFactory(db);
  });

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(baseDb, db);
    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_E2E_GLOBAL_SETTINGS,
          forumEnabled: true,
          courseDiscussionsEnabled: true,
        }),
      })
      .where(isNull(settings.userId));
    emitToRoom.mockClear();
  });

  describe("course discussions", () => {
    it("notifies the thread author and earlier repliers, with a link to the thread", async () => {
      const [threadAuthor, earlierReplier, replier, bystander] = await createStudents(4);
      const course = await createEnrolledCourse(
        threadAuthor,
        threadAuthor,
        earlierReplier,
        replier,
        bystander,
      );
      const thread = await postCourseMessage(threadAuthor, course.id, { content: "A question" });
      await postCourseMessage(earlierReplier, course.id, {
        content: "First answer",
        parentMessageId: thread.id,
      });
      await dispatchOutbox(app);
      emitToRoom.mockClear();

      await postCourseMessage(replier, course.id, {
        content: "Second answer",
        parentMessageId: thread.id,
      });
      await dispatchOutbox(app);

      const expectedNotification = {
        title: replyTitleFrom(replier),
        content: `In the course "${course.title}"`,
        sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_CHAT,
        sourceId: course.id,
        linkPath: `/course/${course.id}?tab=Discussion&thread=${thread.id}`,
        authorId: replier.user.id,
        isRead: false,
      };
      const [latestForAuthor] = await getNotifications(threadAuthor);
      expect(latestForAuthor).toMatchObject(expectedNotification);
      expect(await getNotifications(earlierReplier)).toEqual([
        expect.objectContaining(expectedNotification),
      ]);
      expect(await getUnreadCount(threadAuthor)).toBe(2);
      expect(await getNotifications(replier)).toEqual([]);
      expect(await getNotifications(bystander)).toEqual([]);
      expect(notifiedUserRooms()).toEqual(userRoomsOf(threadAuthor, earlierReplier));
    });

    it("sends the live signal through an event of its own, after the notification is stored", async () => {
      const [threadAuthor, replier] = await createStudents(2);
      const course = await createEnrolledCourse(threadAuthor, threadAuthor, replier);
      const thread = await postCourseMessage(threadAuthor, course.id, { content: "A question" });

      await postCourseMessage(replier, course.id, {
        content: "An answer",
        parentMessageId: thread.id,
      });
      await dispatchOutbox(app);

      const signalEvents = await db
        .select({ payload: outboxEvents.payload })
        .from(outboxEvents)
        .where(eq(outboxEvents.eventType, "UserNotificationsCreatedEvent"));
      expect(signalEvents.map(({ payload }) => payload)).toEqual([
        { userNotificationsCreatedData: { userIds: [threadAuthor.user.id] } },
      ]);
      expect(notifiedUserRooms()).toEqual(userRoomsOf(threadAuthor));
    });

    it("skips course participants who can no longer read the discussion", async () => {
      const [threadAuthor, archivedReplier, formerReader, replier] = await createStudents(4);
      const course = await createEnrolledCourse(
        threadAuthor,
        threadAuthor,
        archivedReplier,
        formerReader,
        replier,
      );
      const thread = await postCourseMessage(threadAuthor, course.id, { content: "A question" });
      for (const participant of [archivedReplier, formerReader]) {
        await postCourseMessage(participant, course.id, {
          content: "An answer",
          parentMessageId: thread.id,
        });
      }
      await dispatchOutbox(app);
      await db.update(users).set({ archived: true }).where(eq(users.id, archivedReplier.user.id));
      await assignSystemRoleToUserInTests(
        db,
        formerReader.user.id,
        formerReader.user.tenantId,
        SYSTEM_ROLE_SLUGS.REVIEWER,
      );
      const notificationsBefore = {
        archivedReplier: await countNotificationsOf(archivedReplier),
        formerReader: await countNotificationsOf(formerReader),
      };
      emitToRoom.mockClear();

      await postCourseMessage(replier, course.id, {
        content: "A later answer",
        parentMessageId: thread.id,
      });
      await dispatchOutbox(app);

      expect({
        archivedReplier: await countNotificationsOf(archivedReplier),
        formerReader: await countNotificationsOf(formerReader),
      }).toEqual(notificationsBefore);
      expect(notifiedUserRooms()).toEqual(userRoomsOf(threadAuthor));
    });

    it("leaves out users the reply mentions and users who left the course", async () => {
      const [threadAuthor, mentionedReplier, formerStudent, replier] = await createStudents(4);
      const course = await createEnrolledCourse(
        threadAuthor,
        threadAuthor,
        mentionedReplier,
        formerStudent,
        replier,
      );
      const thread = await postCourseMessage(threadAuthor, course.id, { content: "A question" });
      for (const participant of [mentionedReplier, formerStudent]) {
        await postCourseMessage(participant, course.id, {
          content: "An answer",
          parentMessageId: thread.id,
        });
      }
      await dispatchOutbox(app);
      await db
        .update(studentCourses)
        .set({ status: COURSE_ENROLLMENT.NOT_ENROLLED })
        .where(
          and(
            eq(studentCourses.courseId, course.id),
            eq(studentCourses.studentId, formerStudent.user.id),
          ),
        );
      const formerStudentNotifications = await getNotifications(formerStudent);
      emitToRoom.mockClear();

      await postCourseMessage(replier, course.id, {
        content: `@${fullNameOf(mentionedReplier)} what do you think?`,
        parentMessageId: thread.id,
        mentionedUserIds: [mentionedReplier.user.id],
      });
      await dispatchOutbox(app);

      const replyTitles = async (participant: Participant) =>
        (await getNotifications(participant)).filter(
          ({ title }) => title === replyTitleFrom(replier),
        );
      expect(await replyTitles(threadAuthor)).toHaveLength(1);
      expect(await replyTitles(mentionedReplier)).toEqual([]);
      expect(await getNotifications(formerStudent)).toEqual(formerStudentNotifications);
      expect(notifiedUserRooms()).toEqual(userRoomsOf(threadAuthor, mentionedReplier));
    });

    it("notifies nobody when the thread author answers their own thread", async () => {
      const threadAuthor = await createStudent();
      const course = await createEnrolledCourse(threadAuthor, threadAuthor);
      const thread = await postCourseMessage(threadAuthor, course.id, { content: "A question" });

      await postCourseMessage(threadAuthor, course.id, {
        content: "Never mind, found it",
        parentMessageId: thread.id,
      });
      await dispatchOutbox(app);

      expect(await getNotifications(threadAuthor)).toEqual([]);
      expect(notifiedUserRooms()).toEqual([]);
    });
  });

  describe("forum topics", () => {
    it("notifies the topic author and earlier repliers, linking to the topic", async () => {
      const [topicAuthor, earlierReplier, replier, bystander] = await createStudents(4);
      const topic = await createTopic(topicAuthor, "Release notes");
      await postForumReply(earlierReplier, topic.id, { content: "First answer" });
      await dispatchOutbox(app);
      emitToRoom.mockClear();

      await postForumReply(replier, topic.id, { content: "Second answer" });
      await dispatchOutbox(app);

      const expectedNotification = {
        title: replyTitleFrom(replier),
        content: 'In the forum topic "Release notes"',
        sourceType: ANNOUNCEMENT_SOURCE_TYPES.FORUM,
        sourceId: topic.id,
        linkPath: null,
        authorId: replier.user.id,
      };
      const [latestForAuthor] = await getNotifications(topicAuthor);
      expect(latestForAuthor).toMatchObject(expectedNotification);
      expect(await getNotifications(earlierReplier)).toEqual([
        expect.objectContaining(expectedNotification),
      ]);
      expect(await getNotifications(replier)).toEqual([]);
      expect(await getNotifications(bystander)).toEqual([]);
      expect(notifiedUserRooms()).toEqual(userRoomsOf(topicAuthor, earlierReplier));
    });

    it("sends a mentioned participant only the mention, live as well, and skips archived users", async () => {
      const [topicAuthor, archivedReplier, replier] = await createStudents(3);
      const topic = await createTopic(topicAuthor, "Release notes");
      await postForumReply(archivedReplier, topic.id, { content: "An answer" });
      await dispatchOutbox(app);
      await db.update(users).set({ archived: true }).where(eq(users.id, archivedReplier.user.id));
      emitToRoom.mockClear();

      await postForumReply(replier, topic.id, {
        content: `@${fullNameOf(topicAuthor)} please check`,
        mentionedUserIds: [topicAuthor.user.id],
      });
      await dispatchOutbox(app);

      const notificationsForAuthor = await getNotifications(topicAuthor);
      const [mention] = notificationsForAuthor;
      expect(mention.title).toBe(`${fullNameOf(replier)} mentioned you`);
      expect(notificationsForAuthor.map(({ title }) => title)).not.toContain(
        replyTitleFrom(replier),
      );
      expect(notifiedUserRooms()).toEqual(userRoomsOf(topicAuthor));
    });

    it("still notifies participants about a reply event stored before mentions were recorded", async () => {
      const [topicAuthor, replier] = await createStudents(2);
      const topic = await createTopic(topicAuthor, "Release notes");
      const [reply] = await db
        .insert(courseChatMessages)
        .values({
          threadId: topic.id,
          userId: replier.user.id,
          content: "A reply",
          parentMessageId: topic.firstPost.id,
          createdAt: sql`CURRENT_TIMESTAMP + interval '1 second'`,
        })
        .returning({ id: courseChatMessages.id });

      await app.get(OutboxPublisher).publish(
        new ForumReplyCreatedEvent({
          topicId: topic.id,
          postId: reply.id,
          firstPostId: topic.firstPost.id,
          actorUserId: replier.user.id,
        }),
      );
      await dispatchOutbox(app);

      expect(await getNotifications(topicAuthor)).toEqual([
        expect.objectContaining({ title: replyTitleFrom(replier) }),
      ]);
    });
  });
});
