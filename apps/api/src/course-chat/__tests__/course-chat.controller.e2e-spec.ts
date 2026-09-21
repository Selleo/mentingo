import { faker } from "@faker-js/faker";
import { COURSE_CHAT_SOCKET_EVENTS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, isNull } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courseChatMessages, settings, studentCourses } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../test/helpers/e2e-settings";
import { assignSystemRoleToUserInTests } from "../../../test/helpers/permission-role-helpers";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("CourseChatController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;
  const emitToRoom = jest.fn();

  const password = "Password123!";

  const setCourseDiscussionsEnabled = async (enabled: boolean) => {
    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_E2E_GLOBAL_SETTINGS,
          courseDiscussionsEnabled: enabled,
        }),
      })
      .where(isNull(settings.userId));
  };

  const createUserWithCookie = async (
    roleSlug: (typeof SYSTEM_ROLE_SLUGS)[keyof typeof SYSTEM_ROLE_SLUGS],
  ) => {
    const factory = userFactory.withCredentials({ password });
    const configuredFactory =
      roleSlug === SYSTEM_ROLE_SLUGS.ADMIN
        ? factory.withAdminSettings(db)
        : factory.withUserSettings(db);
    const user = await configuredFactory.create({ roleSlug, email: faker.internet.email() });
    await assignSystemRoleToUserInTests(db, user.id, user.tenantId, roleSlug);

    return { user, cookie: await cookieFor(user, app) };
  };

  const enroll = async (courseId: string, ...users: UserWithCredentials[]) => {
    await db.insert(studentCourses).values(
      users.map((user) => ({
        courseId,
        studentId: user.id,
      })),
    );
  };

  const createMessage = async (
    cookie: string,
    courseId: string,
    content: string,
    parentMessageId?: string,
  ) => {
    const response = await request(app.getHttpServer())
      .post(`/api/course-chat/${courseId}/messages`)
      .set("Cookie", cookie)
      .send({ content, parentMessageId })
      .expect(201);

    return response.body.data as { id: string; content: string };
  };

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
    await setCourseDiscussionsEnabled(true);
    emitToRoom.mockClear();
  });

  describe("feature gate and access control", () => {
    it("rejects discussion access when the feature is disabled", async () => {
      const { user, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: user.id });
      await enroll(course.id, user);
      const thread = await createMessage(cookie, course.id, "Feature-gated thread");
      await setCourseDiscussionsEnabled(false);

      const requests = [
        () => request(app.getHttpServer()).get(`/api/course-chat/${course.id}/messages`),
        () => request(app.getHttpServer()).get(`/api/course-chat/${course.id}/users`),
        () =>
          request(app.getHttpServer())
            .post(`/api/course-chat/${course.id}/messages`)
            .send({ content: "Blocked" }),
        () => request(app.getHttpServer()).get(`/api/course-chat/messages/${thread.id}/replies`),
        () =>
          request(app.getHttpServer())
            .post(`/api/course-chat/messages/${thread.id}/reactions`)
            .send({ reaction: "👍" }),
        () => request(app.getHttpServer()).delete(`/api/course-chat/messages/${thread.id}`),
      ];

      for (const buildRequest of requests) {
        const response = await buildRequest().set("Cookie", cookie).expect(400);
        expect(response.body.message).toBe("common.toast.noAccess");
      }
    });

    it("requires authentication and the discussion read permission", async () => {
      const { user: student, cookie: studentCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const { user: groupManager, cookie: groupManagerCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
      );
      const course = await courseFactory.create({ authorId: student.id });
      await enroll(course.id, student, groupManager);

      await request(app.getHttpServer()).get(`/api/course-chat/${course.id}/messages`).expect(401);

      const thread = await createMessage(studentCookie, course.id, "Permission target");
      const requests = [
        () => request(app.getHttpServer()).get(`/api/course-chat/${course.id}/messages`),
        () => request(app.getHttpServer()).get(`/api/course-chat/${course.id}/users`),
        () =>
          request(app.getHttpServer())
            .post(`/api/course-chat/${course.id}/messages`)
            .send({ content: "Blocked" }),
        () => request(app.getHttpServer()).get(`/api/course-chat/messages/${thread.id}/replies`),
        () =>
          request(app.getHttpServer())
            .post(`/api/course-chat/messages/${thread.id}/reactions`)
            .send({ reaction: "👍" }),
        () => request(app.getHttpServer()).delete(`/api/course-chat/messages/${thread.id}`),
      ];

      for (const buildRequest of requests) {
        const response = await buildRequest().set("Cookie", groupManagerCookie).expect(403);
        expect(response.body.message).toBe("auth.error.missingPermission");
      }
    });

    it("rejects every discussion operation for a non-enrolled student", async () => {
      const { user: author, cookie: authorCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const { cookie: outsiderCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: author.id });
      await enroll(course.id, author);
      const thread = await createMessage(authorCookie, course.id, "Protected thread");

      const requests = [
        () => request(app.getHttpServer()).get(`/api/course-chat/${course.id}/messages`),
        () => request(app.getHttpServer()).get(`/api/course-chat/${course.id}/users`),
        () =>
          request(app.getHttpServer()).post(`/api/course-chat/${course.id}/messages`).send({
            content: "Unauthorized message",
          }),
        () => request(app.getHttpServer()).get(`/api/course-chat/messages/${thread.id}/replies`),
        () =>
          request(app.getHttpServer())
            .post(`/api/course-chat/messages/${thread.id}/reactions`)
            .send({ reaction: "👍" }),
        () => request(app.getHttpServer()).delete(`/api/course-chat/messages/${thread.id}`),
      ];

      for (const buildRequest of requests) {
        const response = await buildRequest().set("Cookie", outsiderCookie).expect(403);
        expect(response.body.message).toBe("courseChat.errors.notEnrolled");
      }
    });
  });

  describe("deletion and moderation", () => {
    it("enforces own-message deletion and allows enrolled admin moderation", async () => {
      const { user: author, cookie: authorCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const { user: peer, cookie: peerCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const { user: admin, cookie: adminCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.ADMIN,
      );
      const course = await courseFactory.create({ authorId: admin.id });
      await enroll(course.id, author, peer, admin);

      const ownThread = await createMessage(authorCookie, course.id, "Own removable thread");
      await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${ownThread.id}`)
        .set("Cookie", peerCookie)
        .expect(403);

      const ownDeleteResponse = await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${ownThread.id}`)
        .set("Cookie", authorCookie)
        .expect(200);
      expect(ownDeleteResponse.body.data.removed).toBe(true);

      const moderatedThread = await createMessage(authorCookie, course.id, "Moderated thread");
      await createMessage(peerCookie, course.id, "Reply keeps context", moderatedThread.id);
      const moderationResponse = await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${moderatedThread.id}`)
        .set("Cookie", adminCookie)
        .expect(200);

      expect(moderationResponse.body.data).toMatchObject({
        messageId: moderatedThread.id,
        removed: false,
      });

      const messagesResponse = await request(app.getHttpServer())
        .get(`/api/course-chat/${course.id}/messages`)
        .set("Cookie", peerCookie)
        .expect(200);
      expect(messagesResponse.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: moderatedThread.id, deletedAt: expect.any(String) }),
        ]),
      );
    });
  });

  describe("pagination", () => {
    it("paginates top-level messages and replies in their documented order", async () => {
      const { user, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: user.id });
      await enroll(course.id, user);
      const threadIds: string[] = [];
      const baseTime = Date.now() - 60_000;

      for (let index = 0; index < 5; index++) {
        const thread = await createMessage(cookie, course.id, `Thread ${index}`);
        threadIds.push(thread.id);
        await db
          .update(courseChatMessages)
          .set({ createdAt: new Date(baseTime + index * 1000).toISOString() })
          .where(eq(courseChatMessages.id, thread.id));
      }

      const firstPage = await request(app.getHttpServer())
        .get(`/api/course-chat/${course.id}/messages?page=1&perPage=2`)
        .set("Cookie", cookie)
        .expect(200);
      expect(firstPage.body.pagination).toMatchObject({ page: 1, perPage: 2, totalItems: 5 });
      expect(firstPage.body.data.map(({ id }: { id: string }) => id)).toEqual([
        threadIds[3],
        threadIds[4],
      ]);

      const secondPage = await request(app.getHttpServer())
        .get(`/api/course-chat/${course.id}/messages?page=2&perPage=2`)
        .set("Cookie", cookie)
        .expect(200);
      expect(secondPage.body.data.map(({ id }: { id: string }) => id)).toEqual([
        threadIds[1],
        threadIds[2],
      ]);

      const replyIds: string[] = [];
      for (let index = 0; index < 5; index++) {
        const reply = await createMessage(cookie, course.id, `Reply ${index}`, threadIds[0]);
        replyIds.push(reply.id);
        await db
          .update(courseChatMessages)
          .set({ createdAt: new Date(baseTime + index * 1000).toISOString() })
          .where(eq(courseChatMessages.id, reply.id));
      }

      const repliesPage = await request(app.getHttpServer())
        .get(`/api/course-chat/messages/${threadIds[0]}/replies?page=2&perPage=2`)
        .set("Cookie", cookie)
        .expect(200);
      expect(repliesPage.body.pagination).toMatchObject({ page: 2, perPage: 2, totalItems: 5 });
      expect(repliesPage.body.data.map(({ id }: { id: string }) => id)).toEqual([
        replyIds[2],
        replyIds[3],
      ]);
    });
  });

  describe("validation", () => {
    it("rejects invalid message content and reactions", async () => {
      const { user, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: user.id });
      await enroll(course.id, user);
      const thread = await createMessage(cookie, course.id, "Reaction target");

      await request(app.getHttpServer())
        .post(`/api/course-chat/${course.id}/messages`)
        .set("Cookie", cookie)
        .send({ content: "" })
        .expect(400);
      await request(app.getHttpServer())
        .post(`/api/course-chat/${course.id}/messages`)
        .set("Cookie", cookie)
        .send({ content: "x".repeat(5001) })
        .expect(400);

      const reactionResponse = await request(app.getHttpServer())
        .post(`/api/course-chat/messages/${thread.id}/reactions`)
        .set("Cookie", cookie)
        .send({ reaction: "invalid" })
        .expect(400);
      expect(reactionResponse.body.message).toBe("courseChat.errors.invalidReaction");
    });

    it("rejects nested, cross-course, and deleted reply parents", async () => {
      const { user, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const firstCourse = await courseFactory.create({ authorId: user.id });
      const secondCourse = await courseFactory.create({ authorId: user.id });
      await enroll(firstCourse.id, user);
      await enroll(secondCourse.id, user);

      const thread = await createMessage(cookie, firstCourse.id, "Parent thread");
      const reply = await createMessage(cookie, firstCourse.id, "First-level reply", thread.id);

      for (const [courseId, parentMessageId] of [
        [firstCourse.id, reply.id],
        [secondCourse.id, thread.id],
      ]) {
        const response = await request(app.getHttpServer())
          .post(`/api/course-chat/${courseId}/messages`)
          .set("Cookie", cookie)
          .send({ content: "Invalid reply", parentMessageId })
          .expect(400);
        expect(response.body.message).toBe("courseChat.errors.invalidParentMessage");
      }

      const deletedThread = await createMessage(cookie, firstCourse.id, "Deleted parent");
      await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${deletedThread.id}`)
        .set("Cookie", cookie)
        .expect(200);
      const deletedParentResponse = await request(app.getHttpServer())
        .post(`/api/course-chat/${firstCourse.id}/messages`)
        .set("Cookie", cookie)
        .send({ content: "Reply to deleted parent", parentMessageId: deletedThread.id })
        .expect(400);
      expect(deletedParentResponse.body.message).toBe("courseChat.errors.invalidParentMessage");
    });
  });

  describe("messages, users, and mentions", () => {
    it("returns normalized messages, reply summaries, participants, and enrolled users", async () => {
      const { user: author, cookie: authorCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const { user: participant, cookie: participantCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const { user: outsider } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: author.id });
      await enroll(course.id, author, participant);

      const emptyResponse = await request(app.getHttpServer())
        .get(`/api/course-chat/${course.id}/messages`)
        .set("Cookie", authorCookie)
        .expect(200);
      expect(emptyResponse.body).toMatchObject({ data: [], pagination: { totalItems: 0 } });

      const thread = await createMessage(authorCookie, course.id, "  Normalized thread  ");
      const firstReply = await createMessage(
        participantCookie,
        course.id,
        "First reply",
        thread.id,
      );
      const latestReply = await createMessage(authorCookie, course.id, "Latest reply", thread.id);

      const messagesResponse = await request(app.getHttpServer())
        .get(`/api/course-chat/${course.id}/messages`)
        .set("Cookie", authorCookie)
        .expect(200);
      expect(messagesResponse.body.data[0]).toMatchObject({
        id: thread.id,
        content: "Normalized thread",
        replyCount: 2,
        latestReply: { id: latestReply.id, content: "Latest reply" },
      });
      expect(
        messagesResponse.body.data[0].replyParticipants.map(({ id }: { id: string }) => id),
      ).toEqual(expect.arrayContaining([author.id, participant.id]));

      const repliesResponse = await request(app.getHttpServer())
        .get(`/api/course-chat/messages/${thread.id}/replies`)
        .set("Cookie", authorCookie)
        .expect(200);
      expect(repliesResponse.body.data.map(({ id }: { id: string }) => id)).toEqual([
        firstReply.id,
        latestReply.id,
      ]);

      const usersResponse = await request(app.getHttpServer())
        .get(`/api/course-chat/${course.id}/users`)
        .set("Cookie", authorCookie)
        .expect(200);
      expect(usersResponse.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: author.id, isOnline: false }),
          expect.objectContaining({ id: participant.id, isOnline: false }),
        ]),
      );
      expect(usersResponse.body.data).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: outsider.id })]),
      );
    });

    it("notifies each unique enrolled mention target but ignores self and outsiders", async () => {
      const { user: author, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { user: target } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { user: outsider } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: author.id });
      await enroll(course.id, author, target);

      await request(app.getHttpServer())
        .post(`/api/course-chat/${course.id}/messages`)
        .set("Cookie", cookie)
        .send({
          content: "Mention filtering",
          mentionedUserIds: [target.id, target.id, author.id, outsider.id],
        })
        .expect(201);

      const mentionCalls = emitToRoom.mock.calls.filter(
        ([event]) => event === COURSE_CHAT_SOCKET_EVENTS.USER_MENTIONED,
      );
      expect(mentionCalls).toHaveLength(1);
      expect(mentionCalls[0]).toEqual([
        COURSE_CHAT_SOCKET_EVENTS.USER_MENTIONED,
        `user:${target.id}`,
        expect.objectContaining({ courseId: course.id }),
      ]);
    });
  });

  describe("reactions", () => {
    it("aggregates reactions, marks the current user, and toggles them off", async () => {
      const { user: author, cookie: authorCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const { user: peer, cookie: peerCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const course = await courseFactory.create({ authorId: author.id });
      await enroll(course.id, author, peer);
      const thread = await createMessage(authorCookie, course.id, "Reaction summary");

      const authorReaction = await request(app.getHttpServer())
        .post(`/api/course-chat/messages/${thread.id}/reactions`)
        .set("Cookie", authorCookie)
        .send({ reaction: "👍" })
        .expect(201);
      expect(authorReaction.body.data.reactions).toEqual([
        { reaction: "👍", count: 1, reactedByCurrentUser: true },
      ]);

      const peerReaction = await request(app.getHttpServer())
        .post(`/api/course-chat/messages/${thread.id}/reactions`)
        .set("Cookie", peerCookie)
        .send({ reaction: "👍" })
        .expect(201);
      expect(peerReaction.body.data.reactions).toEqual([
        { reaction: "👍", count: 2, reactedByCurrentUser: true },
      ]);

      const toggleOff = await request(app.getHttpServer())
        .post(`/api/course-chat/messages/${thread.id}/reactions`)
        .set("Cookie", authorCookie)
        .send({ reaction: "👍" })
        .expect(201);
      expect(toggleOff.body.data.reactions).toEqual([
        { reaction: "👍", count: 1, reactedByCurrentUser: false },
      ]);
    });

    it("rejects reactions to missing and deleted messages", async () => {
      const { user, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: user.id });
      await enroll(course.id, user);
      const thread = await createMessage(cookie, course.id, "Deleted reaction target");
      await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${thread.id}`)
        .set("Cookie", cookie)
        .expect(200);

      for (const messageId of [thread.id, faker.string.uuid()]) {
        const response = await request(app.getHttpServer())
          .post(`/api/course-chat/messages/${messageId}/reactions`)
          .set("Cookie", cookie)
          .send({ reaction: "👍" })
          .expect(404);
        expect(response.body.message).toBe("courseChat.errors.messageNotFound");
      }
    });
  });

  describe("deletion outcomes", () => {
    it("removes a deleted reply, removes its reactions, and rejects repeated deletion", async () => {
      const { user, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: user.id });
      await enroll(course.id, user);
      const thread = await createMessage(cookie, course.id, "Reply parent");
      const reply = await createMessage(cookie, course.id, "Disposable reply", thread.id);
      await request(app.getHttpServer())
        .post(`/api/course-chat/messages/${reply.id}/reactions`)
        .set("Cookie", cookie)
        .send({ reaction: "🎉" })
        .expect(201);

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${reply.id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(deleteResponse.body.data).toMatchObject({
        messageId: reply.id,
        parentMessageId: thread.id,
        removed: true,
      });

      const repliesResponse = await request(app.getHttpServer())
        .get(`/api/course-chat/messages/${thread.id}/replies`)
        .set("Cookie", cookie)
        .expect(200);
      expect(repliesResponse.body).toMatchObject({ data: [], pagination: { totalItems: 0 } });

      await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${reply.id}`)
        .set("Cookie", cookie)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/course-chat/messages/${reply.id}/reactions`)
        .set("Cookie", cookie)
        .send({ reaction: "🎉" })
        .expect(404);
    });

    it("requires moderators to be enrolled even when they can delete any message", async () => {
      const { user: author, cookie: authorCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const { cookie: adminCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await courseFactory.create({ authorId: author.id });
      await enroll(course.id, author);
      const thread = await createMessage(authorCookie, course.id, "Enrollment before moderation");

      const response = await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${thread.id}`)
        .set("Cookie", adminCookie)
        .expect(403);
      expect(response.body.message).toBe("courseChat.errors.notEnrolled");
    });
  });

  describe("not-found and pagination boundaries", () => {
    it("returns not found for missing reply parents", async () => {
      const { user, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: user.id });
      await enroll(course.id, user);

      const response = await request(app.getHttpServer())
        .get(`/api/course-chat/messages/${faker.string.uuid()}/replies`)
        .set("Cookie", cookie)
        .expect(404);
      expect(response.body.message).toBe("courseChat.errors.messageNotFound");
    });

    it("validates pagination bounds and returns an empty page beyond the result set", async () => {
      const { user, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: user.id });
      await enroll(course.id, user);
      await createMessage(cookie, course.id, "Only thread");

      for (const query of ["page=0", "perPage=0"]) {
        await request(app.getHttpServer())
          .get(`/api/course-chat/${course.id}/messages?${query}`)
          .set("Cookie", cookie)
          .expect(400);
      }

      const response = await request(app.getHttpServer())
        .get(`/api/course-chat/${course.id}/messages?page=2&perPage=10`)
        .set("Cookie", cookie)
        .expect(200);
      expect(response.body).toMatchObject({
        data: [],
        pagination: { page: 2, perPage: 10, totalItems: 1 },
      });
    });
  });
});
