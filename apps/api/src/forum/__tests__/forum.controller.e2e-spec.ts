import { faker } from "@faker-js/faker";
import {
  DISCUSSION_SCOPES,
  FORUM_TOPIC_SORTS,
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  type PermissionKey,
} from "@repo/shared";
import { eq, inArray, isNull } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  courseChatThreads,
  permissionRuleSetPermissions,
  settings,
  studentCourses,
} from "src/storage/schema";
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

type ForumTopicListItem = {
  id: string;
  scope: string;
  title: string | null;
  excerpt: string;
  isDeleted: boolean;
  replyCount: number;
  course: { id: string; title: string } | null;
  author: { id: string; firstName: string; lastName: string };
};

describe("ForumController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;
  const emitToRoom = jest.fn();

  const password = "Password123!";

  const setGlobalSettings = async (
    overrides: { forumEnabled?: boolean; courseDiscussionsEnabled?: boolean } = {},
  ) => {
    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_E2E_GLOBAL_SETTINGS,
          forumEnabled: true,
          courseDiscussionsEnabled: true,
          ...overrides,
        }),
      })
      .where(isNull(settings.userId));
  };

  const createUserWithCookie = async (
    roleSlug: (typeof SYSTEM_ROLE_SLUGS)[keyof typeof SYSTEM_ROLE_SLUGS],
    revokedPermissions: PermissionKey[] = [],
  ) => {
    const factory = userFactory.withCredentials({ password });
    const configuredFactory =
      roleSlug === SYSTEM_ROLE_SLUGS.ADMIN
        ? factory.withAdminSettings(db)
        : factory.withUserSettings(db);
    const user = await configuredFactory.create({ roleSlug, email: faker.internet.email() });
    await assignSystemRoleToUserInTests(db, user.id, user.tenantId, roleSlug);

    if (revokedPermissions.length) {
      await db
        .delete(permissionRuleSetPermissions)
        .where(inArray(permissionRuleSetPermissions.permission, revokedPermissions));
    }

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

  const createTopic = async (cookie: string, body: { title: string; content: string }) => {
    const response = await request(app.getHttpServer())
      .post("/api/forum/topics")
      .set("Cookie", cookie)
      .send(body)
      .expect(201);

    return response.body.data as { id: string; firstPost: { id: string } };
  };

  const createReply = async (cookie: string, topicId: string, content: string) => {
    const response = await request(app.getHttpServer())
      .post(`/api/forum/topics/${topicId}/posts`)
      .set("Cookie", cookie)
      .send({ content })
      .expect(201);

    return response.body.data as { id: string; content: string };
  };

  const createCourseThread = async (cookie: string, courseId: string, content: string) => {
    const response = await request(app.getHttpServer())
      .post(`/api/course-chat/${courseId}/messages`)
      .set("Cookie", cookie)
      .send({ content })
      .expect(201);

    return response.body.data as { id: string };
  };

  const listTopics = async (cookie: string, query: Record<string, string | number> = {}) => {
    const response = await request(app.getHttpServer())
      .get("/api/forum/topics")
      .query({ language: "en", ...query })
      .set("Cookie", cookie)
      .expect(200);

    return response.body as {
      data: ForumTopicListItem[];
      pagination: { totalItems: number; page: number; perPage: number };
    };
  };

  const setThreadTimes = async (topicId: string, createdAt: string, updatedAt: string) => {
    await db
      .update(courseChatThreads)
      .set({ createdAt, updatedAt })
      .where(eq(courseChatThreads.id, topicId));
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
    await setGlobalSettings();
    emitToRoom.mockClear();
  });

  describe("feature gate and authentication", () => {
    it("rejects forum requests when the forum is disabled", async () => {
      const { cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      await setGlobalSettings({ forumEnabled: false });

      const listResponse = await request(app.getHttpServer())
        .get("/api/forum/topics")
        .set("Cookie", cookie)
        .expect(400);
      expect(listResponse.body.message).toBe("common.toast.noAccess");

      await request(app.getHttpServer())
        .post("/api/forum/topics")
        .set("Cookie", cookie)
        .send({ title: "Blocked", content: "Blocked" })
        .expect(400);
    });

    it("requires authentication", async () => {
      await request(app.getHttpServer()).get("/api/forum/topics").expect(401);
      await request(app.getHttpServer())
        .post("/api/forum/topics")
        .send({ title: "Anonymous", content: "Anonymous" })
        .expect(401);
    });

    it("requires the forum permission for each action", async () => {
      const { cookie: authorCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const topic = await createTopic(authorCookie, { title: "Welcome", content: "Say hello" });

      const { cookie: readOnlyCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT, [
        PERMISSIONS.FORUM_TOPIC_CREATE,
        PERMISSIONS.FORUM_POST_CREATE,
      ]);

      expect((await listTopics(readOnlyCookie)).data.map(({ id }) => id)).toEqual([topic.id]);

      const writeRequests = [
        () =>
          request(app.getHttpServer())
            .post("/api/forum/topics")
            .send({ title: "Blocked", content: "Blocked" }),
        () =>
          request(app.getHttpServer())
            .post(`/api/forum/topics/${topic.id}/posts`)
            .send({ content: "Blocked" }),
      ];

      for (const buildRequest of writeRequests) {
        const response = await buildRequest().set("Cookie", readOnlyCookie).expect(403);
        expect(response.body.message).toBe("auth.error.missingPermission");
      }

      const { cookie: noAccessCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT, [
        PERMISSIONS.FORUM_READ,
      ]);

      const readRequests = [
        () => request(app.getHttpServer()).get("/api/forum/topics").query({ language: "en" }),
        () =>
          request(app.getHttpServer())
            .get(`/api/forum/topics/${topic.id}`)
            .query({ language: "en" }),
        () => request(app.getHttpServer()).get(`/api/forum/topics/${topic.id}/posts`),
        () => request(app.getHttpServer()).delete(`/api/forum/posts/${topic.firstPost.id}`),
      ];

      for (const buildRequest of readRequests) {
        const response = await buildRequest().set("Cookie", noAccessCookie).expect(403);
        expect(response.body.message).toBe("auth.error.missingPermission");
      }
    });
  });

  describe("general topics", () => {
    it("lets every signed-in role create, read and reply to topics", async () => {
      const { user: reviewer, cookie: reviewerCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.REVIEWER,
      );
      const { cookie: trainerCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.TRAINER);
      const { cookie: studentCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { cookie: adminCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.ADMIN);

      const topic = await createTopic(reviewerCookie, {
        title: "  Onboarding tips  ",
        content: "  What helped you most in your first week?  ",
      });

      expect(topic).toMatchObject({
        scope: DISCUSSION_SCOPES.GENERAL,
        title: "Onboarding tips",
        course: null,
        replyCount: 0,
        author: { id: reviewer.id },
        firstPost: {
          content: "What helped you most in your first week?",
          isFirstPost: true,
          deletedAt: null,
          reactions: [],
        },
      });

      await createReply(trainerCookie, topic.id, "Shadowing a teammate.");
      await createReply(studentCookie, topic.id, "The welcome checklist.");

      const { data, pagination } = await listTopics(adminCookie);
      expect(pagination.totalItems).toBe(1);
      expect(data[0]).toMatchObject({
        id: topic.id,
        title: "Onboarding tips",
        excerpt: "What helped you most in your first week?",
        isDeleted: false,
        replyCount: 2,
        course: null,
      });

      const detail = await request(app.getHttpServer())
        .get(`/api/forum/topics/${topic.id}`)
        .query({ language: "en" })
        .set("Cookie", studentCookie)
        .expect(200);
      expect(detail.body.data).toMatchObject({ id: topic.id, replyCount: 2 });

      const posts = await request(app.getHttpServer())
        .get(`/api/forum/topics/${topic.id}/posts`)
        .set("Cookie", reviewerCookie)
        .expect(200);
      expect(posts.body.data.map((post: { content: string }) => post.content)).toEqual([
        "Shadowing a teammate.",
        "The welcome checklist.",
      ]);
      expect(posts.body.pagination.totalItems).toBe(2);
      expect(posts.body.data[0]).toMatchObject({ topicId: topic.id, isFirstPost: false });
    });

    it("sorts, filters, searches and paginates topics", async () => {
      const { cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const oldest = await createTopic(cookie, {
        title: "Quarterly goals",
        content: "Let's collect ideas.",
      });
      const middle = await createTopic(cookie, {
        title: "Budget planning",
        content: "Spreadsheet templates?",
      });
      const newest = await createTopic(cookie, {
        title: "Team offsite",
        content: "Where should we go? 100% remote is fine too.",
      });

      await createReply(cookie, oldest.id, "First idea");
      await createReply(cookie, oldest.id, "Second idea");
      await createReply(cookie, middle.id, "Use the finance template");

      await setThreadTimes(oldest.id, "2026-01-01T10:00:00.000Z", "2026-01-05T10:00:00.000Z");
      await setThreadTimes(middle.id, "2026-01-02T10:00:00.000Z", "2026-01-03T10:00:00.000Z");
      await setThreadTimes(newest.id, "2026-01-04T10:00:00.000Z", "2026-01-04T10:00:00.000Z");

      const idsFor = async (query: Record<string, string | number>) =>
        (await listTopics(cookie, query)).data.map((topic) => topic.id);

      expect(await idsFor({})).toEqual([oldest.id, newest.id, middle.id]);
      expect(await idsFor({ sort: FORUM_TOPIC_SORTS.NEWEST })).toEqual([
        newest.id,
        middle.id,
        oldest.id,
      ]);
      expect(await idsFor({ sort: FORUM_TOPIC_SORTS.MOST_REPLIES })).toEqual([
        oldest.id,
        middle.id,
        newest.id,
      ]);

      expect(await idsFor({ search: "budget" })).toEqual([middle.id]);
      expect(await idsFor({ search: "where should" })).toEqual([newest.id]);
      expect(await idsFor({ search: "100%" })).toEqual([newest.id]);
      expect(await idsFor({ search: "%" })).toEqual([newest.id]);
      expect(await idsFor({ scope: DISCUSSION_SCOPES.COURSE })).toEqual([]);

      const secondPage = await listTopics(cookie, {
        sort: FORUM_TOPIC_SORTS.NEWEST,
        page: 2,
        perPage: 2,
      });
      expect(secondPage.data.map((topic) => topic.id)).toEqual([oldest.id]);
      expect(secondPage.pagination).toEqual({ totalItems: 3, page: 2, perPage: 2 });
    });
  });

  describe("course threads", () => {
    it("lists course threads only for users enrolled in the course", async () => {
      const { user: enrolledStudent, cookie: enrolledCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const { cookie: outsiderCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: enrolledStudent.id });
      await enroll(course.id, enrolledStudent);

      const courseThread = await createCourseThread(
        enrolledCookie,
        course.id,
        "Question about chapter two",
      );
      const generalTopic = await createTopic(outsiderCookie, {
        title: "General topic",
        content: "Visible to everyone",
      });

      const enrolledList = await listTopics(enrolledCookie);
      const listedCourseThread = enrolledList.data.find(
        (topic) => topic.scope === DISCUSSION_SCOPES.COURSE,
      );
      expect(enrolledList.pagination.totalItems).toBe(2);
      expect(listedCourseThread).toMatchObject({
        title: null,
        excerpt: "Question about chapter two",
        course: { id: course.id, title: course.title },
      });

      const courseFilter = await listTopics(enrolledCookie, { courseId: course.id });
      expect(courseFilter.data.map((topic) => topic.course?.id)).toEqual([course.id]);
      const generalFilter = await listTopics(enrolledCookie, { scope: DISCUSSION_SCOPES.GENERAL });
      expect(generalFilter.data.map((topic) => topic.id)).toEqual([generalTopic.id]);

      const outsiderList = await listTopics(outsiderCookie);
      expect(outsiderList.data.map((topic) => topic.id)).toEqual([generalTopic.id]);

      const courseTopicId = listedCourseThread?.id;
      expect(courseTopicId).toBeDefined();

      const outsiderRequests = [
        () => request(app.getHttpServer()).get(`/api/forum/topics/${courseTopicId}`),
        () => request(app.getHttpServer()).get(`/api/forum/topics/${courseTopicId}/posts`),
        () =>
          request(app.getHttpServer())
            .post(`/api/forum/topics/${courseTopicId}/posts`)
            .send({ content: "Let me in" }),
        () => request(app.getHttpServer()).delete(`/api/forum/posts/${courseThread.id}`),
      ];

      for (const buildRequest of outsiderRequests) {
        const response = await buildRequest().set("Cookie", outsiderCookie).expect(404);
        expect(response.body.message).toBe("forum.errors.topicNotFound");
      }
    });

    it("hides course threads when course discussions are disabled", async () => {
      const { user: student, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: student.id });
      await enroll(course.id, student);
      await createCourseThread(cookie, course.id, "Course-only thread");
      const [{ id: courseTopicId }] = (await listTopics(cookie)).data;

      await setGlobalSettings({ courseDiscussionsEnabled: false });

      expect((await listTopics(cookie)).data).toEqual([]);
      await request(app.getHttpServer())
        .get(`/api/forum/topics/${courseTopicId}`)
        .set("Cookie", cookie)
        .expect(404);
    });

    it("adds forum replies to course threads in the course discussion", async () => {
      const { user: student, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { user: classmate, cookie: classmateCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const course = await courseFactory.create({ authorId: student.id });
      await enroll(course.id, student, classmate);

      const courseThread = await createCourseThread(
        cookie,
        course.id,
        "Who wants to study together?",
      );
      const [{ id: courseTopicId }] = (await listTopics(classmateCookie)).data;

      const reply = await createReply(classmateCookie, courseTopicId, "Count me in");

      const courseMessages = await request(app.getHttpServer())
        .get(`/api/course-chat/${course.id}/messages`)
        .set("Cookie", cookie)
        .expect(200);
      expect(courseMessages.body.data).toEqual([
        expect.objectContaining({ id: courseThread.id, replyCount: 1 }),
      ]);

      const courseReplies = await request(app.getHttpServer())
        .get(`/api/course-chat/messages/${courseThread.id}/replies`)
        .set("Cookie", cookie)
        .expect(200);
      expect(courseReplies.body.data.map((message: { id: string }) => message.id)).toEqual([
        reply.id,
      ]);
    });

    it("keeps course discussion endpoints away from general forum posts", async () => {
      const { user: student, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: student.id });
      await enroll(course.id, student);
      const topic = await createTopic(cookie, { title: "General", content: "Not a course" });

      await request(app.getHttpServer())
        .post(`/api/course-chat/messages/${topic.firstPost.id}/reactions`)
        .set("Cookie", cookie)
        .send({ reaction: "👍" })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/course-chat/messages/${topic.firstPost.id}/replies`)
        .set("Cookie", cookie)
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${topic.firstPost.id}`)
        .set("Cookie", cookie)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/course-chat/${course.id}/messages`)
        .set("Cookie", cookie)
        .send({ content: "Reply", parentMessageId: topic.firstPost.id })
        .expect(400);
    });
  });

  describe("deleting posts", () => {
    it("lets authors delete their own posts and moderators delete any post", async () => {
      const { cookie: authorCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { cookie: otherCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { cookie: adminCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.ADMIN);

      const topic = await createTopic(authorCookie, { title: "Retro", content: "What went well?" });
      const ownReply = await createReply(otherCookie, topic.id, "Pairing sessions");
      const keptReply = await createReply(otherCookie, topic.id, "Short standups");

      const forbidden = await request(app.getHttpServer())
        .delete(`/api/forum/posts/${ownReply.id}`)
        .set("Cookie", authorCookie)
        .expect(403);
      expect(forbidden.body.message).toBe("forum.errors.cannotDeletePost");

      const deletedReply = await request(app.getHttpServer())
        .delete(`/api/forum/posts/${ownReply.id}`)
        .set("Cookie", otherCookie)
        .expect(200);
      expect(deletedReply.body.data).toMatchObject({
        topicId: topic.id,
        postId: ownReply.id,
        isFirstPost: false,
        removed: true,
      });

      await request(app.getHttpServer())
        .delete(`/api/forum/posts/${ownReply.id}`)
        .set("Cookie", otherCookie)
        .expect(404);

      const deletedFirstPost = await request(app.getHttpServer())
        .delete(`/api/forum/posts/${topic.firstPost.id}`)
        .set("Cookie", adminCookie)
        .expect(200);
      expect(deletedFirstPost.body.data).toMatchObject({ isFirstPost: true, removed: false });

      const [listedTopic] = (await listTopics(otherCookie)).data;
      expect(listedTopic).toMatchObject({
        id: topic.id,
        excerpt: "",
        isDeleted: true,
        replyCount: 1,
      });

      const detail = await request(app.getHttpServer())
        .get(`/api/forum/topics/${topic.id}`)
        .set("Cookie", otherCookie)
        .expect(200);
      expect(detail.body.data.firstPost).toMatchObject({ content: "", reactions: [] });
      expect(detail.body.data.firstPost.deletedAt).not.toBeNull();

      const replyToDeleted = await request(app.getHttpServer())
        .post(`/api/forum/topics/${topic.id}/posts`)
        .set("Cookie", otherCookie)
        .send({ content: "Anyone?" })
        .expect(400);
      expect(replyToDeleted.body.message).toBe("forum.errors.topicDeleted");

      await request(app.getHttpServer())
        .delete(`/api/forum/posts/${keptReply.id}`)
        .set("Cookie", otherCookie)
        .expect(200);

      expect((await listTopics(otherCookie)).data).toEqual([]);
      await request(app.getHttpServer())
        .get(`/api/forum/topics/${topic.id}`)
        .set("Cookie", otherCookie)
        .expect(404);
    });

    it("removes a topic whose only post is deleted by its author", async () => {
      const { cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const topic = await createTopic(cookie, { title: "Typo", content: "Posted by mistake" });

      const response = await request(app.getHttpServer())
        .delete(`/api/forum/posts/${topic.firstPost.id}`)
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.data).toMatchObject({ isFirstPost: true, removed: true });
      expect((await listTopics(cookie)).data).toEqual([]);
    });
  });

  describe("validation", () => {
    it("rejects invalid topics, posts and queries", async () => {
      const { cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const topic = await createTopic(cookie, { title: "Valid", content: "Valid content" });

      const blankTitle = await request(app.getHttpServer())
        .post("/api/forum/topics")
        .set("Cookie", cookie)
        .send({ title: "   ", content: "Content" })
        .expect(400);
      expect(blankTitle.body.message).toBe("forum.errors.emptyTitle");

      const blankReply = await request(app.getHttpServer())
        .post(`/api/forum/topics/${topic.id}/posts`)
        .set("Cookie", cookie)
        .send({ content: "   " })
        .expect(400);
      expect(blankReply.body.message).toBe("forum.errors.emptyContent");

      const invalidRequests = [
        () =>
          request(app.getHttpServer())
            .post("/api/forum/topics")
            .send({ title: "x".repeat(201), content: "Content" }),
        () => request(app.getHttpServer()).post("/api/forum/topics").send({ title: "No content" }),
        () => request(app.getHttpServer()).get("/api/forum/topics").query({ sort: "random" }),
        () => request(app.getHttpServer()).get("/api/forum/topics").query({ perPage: 101 }),
        () => request(app.getHttpServer()).get("/api/forum/topics/not-a-uuid"),
      ];

      for (const buildRequest of invalidRequests) {
        await buildRequest().set("Cookie", cookie).expect(400);
      }

      await request(app.getHttpServer())
        .get(`/api/forum/topics/${faker.string.uuid()}`)
        .set("Cookie", cookie)
        .expect(404);
    });
  });
});
