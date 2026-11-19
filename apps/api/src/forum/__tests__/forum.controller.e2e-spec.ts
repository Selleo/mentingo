import { faker } from "@faker-js/faker";
import {
  FORUM_POST_MAX_MENTIONS,
  FORUM_SOCKET_EVENTS,
  FORUM_TOPIC_SORTS,
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  getForumRoom,
  getForumTopicRoom,
  type PermissionKey,
} from "@repo/shared";
import { eq, inArray, isNull } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  courseChatThreads,
  outboxEvents,
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
  title: string;
  excerpt: string;
  isDeleted: boolean;
  replyCount: number;
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

  const createTopic = async (
    cookie: string,
    body: { title: string; content: string; mentionedUserIds?: string[] },
  ) => {
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
      .query(query)
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
        () => request(app.getHttpServer()).get("/api/forum/topics"),
        () => request(app.getHttpServer()).get(`/api/forum/topics/${topic.id}`),
        () => request(app.getHttpServer()).get(`/api/forum/topics/${topic.id}/posts`),
        () => request(app.getHttpServer()).delete(`/api/forum/posts/${topic.firstPost.id}`),
      ];

      for (const buildRequest of readRequests) {
        const response = await buildRequest().set("Cookie", noAccessCookie).expect(403);
        expect(response.body.message).toBe("auth.error.missingPermission");
      }

      const actionsThatAlsoNeedReadAccess = [
        () =>
          request(app.getHttpServer())
            .post("/api/forum/topics")
            .send({ title: "Blocked", content: "Blocked" }),
        () =>
          request(app.getHttpServer())
            .post(`/api/forum/topics/${topic.id}/posts`)
            .send({ content: "Blocked" }),
        () =>
          request(app.getHttpServer())
            .post(`/api/forum/posts/${topic.firstPost.id}/reactions`)
            .send({ reaction: "👍" }),
        () => request(app.getHttpServer()).get("/api/forum/users"),
      ];

      for (const buildRequest of actionsThatAlsoNeedReadAccess) {
        const response = await buildRequest().set("Cookie", noAccessCookie).expect(403);
        expect(response.body.message).toBe("auth.error.missingPermission");
      }
    });

    it("keeps reviewers out of the forum", async () => {
      const { cookie: reviewerCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.REVIEWER);

      const response = await request(app.getHttpServer())
        .get("/api/forum/topics")
        .set("Cookie", reviewerCookie)
        .expect(403);
      expect(response.body.message).toBe("auth.error.missingPermission");
    });
  });

  describe("general topics", () => {
    it("lets users of different roles create, read and reply to topics", async () => {
      const { user: contentCreator, cookie: contentCreatorCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      );
      const { cookie: trainerCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.TRAINER);
      const { cookie: studentCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { cookie: adminCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.ADMIN);

      const topic = await createTopic(contentCreatorCookie, {
        title: "  Onboarding tips  ",
        content: "  What helped you most in your first week?  ",
      });

      expect(topic).toMatchObject({
        title: "Onboarding tips",
        replyCount: 0,
        author: { id: contentCreator.id },
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
      });

      const detail = await request(app.getHttpServer())
        .get(`/api/forum/topics/${topic.id}`)
        .set("Cookie", studentCookie)
        .expect(200);
      expect(detail.body.data).toMatchObject({ id: topic.id, replyCount: 2 });

      const posts = await request(app.getHttpServer())
        .get(`/api/forum/topics/${topic.id}/posts`)
        .set("Cookie", contentCreatorCookie)
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

      const secondPage = await listTopics(cookie, {
        sort: FORUM_TOPIC_SORTS.NEWEST,
        page: 2,
        perPage: 2,
      });
      expect(secondPage.data.map((topic) => topic.id)).toEqual([oldest.id]);
      expect(secondPage.pagination).toEqual({ totalItems: 3, page: 2, perPage: 2 });
    });
  });

  describe("course discussions", () => {
    const listCourseDiscussions = async (
      cookie: string,
      query: Record<string, string | number> = {},
    ) => {
      const response = await request(app.getHttpServer())
        .get("/api/forum/course-discussions")
        .query({ language: "en", ...query })
        .set("Cookie", cookie)
        .expect(200);

      return response.body as {
        data: { courseId: string; courseTitle: string; messageCount: number }[];
        pagination: { totalItems: number; page: number; perPage: number };
      };
    };

    const getCourseDiscussions = async (cookie: string) =>
      (await listCourseDiscussions(cookie)).data;

    it("summarizes each enrolled course's discussion as one entry", async () => {
      const { user: student, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { user: classmate, cookie: classmateCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
      );
      const quietCourse = await courseFactory.create({ authorId: student.id });
      const busyCourse = await courseFactory.create({ authorId: student.id });
      const otherCourse = await courseFactory.create({ authorId: student.id });
      await enroll(quietCourse.id, student);
      await enroll(busyCourse.id, student, classmate);
      await enroll(otherCourse.id, classmate);

      await createCourseThread(cookie, quietCourse.id, "Quiet question");
      await createCourseThread(classmateCookie, otherCourse.id, "Not for the student");
      const busyThread = await createCourseThread(cookie, busyCourse.id, "Busy question");
      const deletedThread = await createCourseThread(cookie, busyCourse.id, "Posted by mistake");
      await request(app.getHttpServer())
        .post(`/api/course-chat/${busyCourse.id}/messages`)
        .set("Cookie", classmateCookie)
        .send({ content: "An answer", parentMessageId: busyThread.id })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${deletedThread.id}`)
        .set("Cookie", cookie)
        .expect(200);

      expect(await getCourseDiscussions(cookie)).toEqual([
        expect.objectContaining({
          courseId: busyCourse.id,
          courseTitle: busyCourse.title,
          messageCount: 2,
        }),
        expect.objectContaining({ courseId: quietCourse.id, messageCount: 1 }),
      ]);
    });

    it("searches and paginates course discussions", async () => {
      const { user: student, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const titles = ["Sales basics", "Sales 100% advanced", "Onboarding"];
      const createdCourses = [];

      for (const title of titles) {
        const course = await courseFactory.create({ authorId: student.id, title });
        await enroll(course.id, student);
        await createCourseThread(cookie, course.id, `Question about ${title}`);
        createdCourses.push(course);
      }
      const [salesBasics, salesAdvanced, onboarding] = createdCourses;

      const firstPage = await listCourseDiscussions(cookie, { page: 1, perPage: 2 });
      expect(firstPage.data.map((course) => course.courseId)).toEqual([
        onboarding.id,
        salesAdvanced.id,
      ]);
      expect(firstPage.pagination).toEqual({ totalItems: 3, page: 1, perPage: 2 });

      const secondPage = await listCourseDiscussions(cookie, { page: 2, perPage: 2 });
      expect(secondPage.data.map((course) => course.courseId)).toEqual([salesBasics.id]);

      const pagePastTheEnd = await listCourseDiscussions(cookie, { page: 5, perPage: 2 });
      expect(pagePastTheEnd.data).toEqual([]);
      expect(pagePastTheEnd.pagination.totalItems).toBe(3);

      const salesOnly = await listCourseDiscussions(cookie, { search: " sales " });
      expect(salesOnly.data.map((course) => course.courseId)).toEqual([
        salesAdvanced.id,
        salesBasics.id,
      ]);
      expect(salesOnly.pagination.totalItems).toBe(2);

      const literalPercent = await listCourseDiscussions(cookie, { search: "100%" });
      expect(literalPercent.data.map((course) => course.courseId)).toEqual([salesAdvanced.id]);
    });

    it("lists no course discussions when they are disabled or the user may not read them", async () => {
      const { user: student, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: student.id });
      await enroll(course.id, student);
      await createCourseThread(cookie, course.id, "Course question");
      expect(await getCourseDiscussions(cookie)).toHaveLength(1);

      const { user: restricted, cookie: restrictedCookie } = await createUserWithCookie(
        SYSTEM_ROLE_SLUGS.STUDENT,
        [PERMISSIONS.COURSE_DISCUSSION_READ],
      );
      await enroll(course.id, restricted);
      expect(await getCourseDiscussions(restrictedCookie)).toEqual([]);

      await setGlobalSettings({ courseDiscussionsEnabled: false });
      expect(await getCourseDiscussions(cookie)).toEqual([]);
    });

    it("describes one course discussion for enrolled users only", async () => {
      const { user: student, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { cookie: outsiderCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: student.id });
      await enroll(course.id, student);
      const getCourseDiscussion = (cookie: string) =>
        request(app.getHttpServer())
          .get(`/api/forum/course-discussions/${course.id}`)
          .query({ language: "en" })
          .set("Cookie", cookie);

      const emptyDiscussion = await getCourseDiscussion(cookie).expect(200);
      expect(emptyDiscussion.body.data).toEqual({
        courseId: course.id,
        courseTitle: course.title,
        messageCount: 0,
        lastActivityAt: null,
      });

      await createCourseThread(cookie, course.id, "Course question");
      const discussion = await getCourseDiscussion(cookie).expect(200);
      expect(discussion.body.data).toMatchObject({ courseId: course.id, messageCount: 1 });
      expect(discussion.body.data.lastActivityAt).toEqual(expect.any(String));

      const notEnrolled = await getCourseDiscussion(outsiderCookie).expect(404);
      expect(notEnrolled.body.message).toBe("forum.errors.courseDiscussionNotFound");

      await setGlobalSettings({ courseDiscussionsEnabled: false });
      await getCourseDiscussion(cookie).expect(404);
    });

    it("keeps course threads out of the forum topics", async () => {
      const { user: student, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: student.id });
      await enroll(course.id, student);
      const courseThread = await createCourseThread(cookie, course.id, "Course question");
      const [{ id: courseThreadId }] = await db
        .select({ id: courseChatThreads.id })
        .from(courseChatThreads)
        .where(eq(courseChatThreads.courseId, course.id));

      expect((await listTopics(cookie)).data).toEqual([]);

      const forumRequests = [
        () => request(app.getHttpServer()).get(`/api/forum/topics/${courseThreadId}`),
        () => request(app.getHttpServer()).get(`/api/forum/topics/${courseThreadId}/posts`),
        () =>
          request(app.getHttpServer())
            .post(`/api/forum/topics/${courseThreadId}/posts`)
            .send({ content: "Reply from the forum" }),
        () =>
          request(app.getHttpServer())
            .post(`/api/forum/posts/${courseThread.id}/reactions`)
            .send({ reaction: "👍" }),
        () => request(app.getHttpServer()).delete(`/api/forum/posts/${courseThread.id}`),
      ];

      for (const buildRequest of forumRequests) {
        await buildRequest().set("Cookie", cookie).expect(404);
      }
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
        topicRemoved: false,
      });

      await request(app.getHttpServer())
        .delete(`/api/forum/posts/${ownReply.id}`)
        .set("Cookie", otherCookie)
        .expect(404);

      const deletedFirstPost = await request(app.getHttpServer())
        .delete(`/api/forum/posts/${topic.firstPost.id}`)
        .set("Cookie", adminCookie)
        .expect(200);
      expect(deletedFirstPost.body.data).toMatchObject({
        isFirstPost: true,
        removed: false,
        topicRemoved: false,
      });

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

      const deletedLastReply = await request(app.getHttpServer())
        .delete(`/api/forum/posts/${keptReply.id}`)
        .set("Cookie", otherCookie)
        .expect(200);
      expect(deletedLastReply.body.data).toMatchObject({
        isFirstPost: false,
        removed: true,
        topicRemoved: true,
      });

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

      expect(response.body.data).toMatchObject({
        isFirstPost: true,
        removed: true,
        topicRemoved: true,
      });
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

  describe("reactions", () => {
    const react = (cookie: string, postId: string, reaction: string) =>
      request(app.getHttpServer())
        .post(`/api/forum/posts/${postId}/reactions`)
        .set("Cookie", cookie)
        .send({ reaction });

    it("toggles reactions on forum posts and requires the react permission", async () => {
      const { cookie: authorCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { cookie: readerCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const topic = await createTopic(authorCookie, { title: "Launch", content: "We are live" });
      emitToRoom.mockClear();

      const reacted = await react(readerCookie, topic.firstPost.id, "👍").expect(201);
      expect(reacted.body.data).toEqual({
        topicId: topic.id,
        postId: topic.firstPost.id,
        reactions: [{ reaction: "👍", count: 1, reactedByCurrentUser: true }],
      });
      expect(emitToRoom).toHaveBeenCalledWith(
        FORUM_SOCKET_EVENTS.TOPIC_CHANGED,
        getForumTopicRoom(topic.id),
        { topicId: topic.id },
      );

      const authorView = await request(app.getHttpServer())
        .get(`/api/forum/topics/${topic.id}`)
        .set("Cookie", authorCookie)
        .expect(200);
      expect(authorView.body.data.firstPost.reactions).toEqual([
        { reaction: "👍", count: 1, reactedByCurrentUser: false },
      ]);

      const toggledOff = await react(readerCookie, topic.firstPost.id, "👍").expect(201);
      expect(toggledOff.body.data.reactions).toEqual([]);

      const invalid = await react(readerCookie, topic.firstPost.id, "🚀").expect(400);
      expect(invalid.body.message).toBe("forum.errors.invalidReaction");

      const { cookie: noReactCookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT, [
        PERMISSIONS.FORUM_POST_REACT,
      ]);
      const forbidden = await react(noReactCookie, topic.firstPost.id, "👍").expect(403);
      expect(forbidden.body.message).toBe("auth.error.missingPermission");
    });
  });

  describe("mentions", () => {
    it("lists the users who can be mentioned", async () => {
      const { user: author, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { user: colleague } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const { user: reviewer } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.REVIEWER);

      const response = await request(app.getHttpServer())
        .get("/api/forum/users")
        .set("Cookie", cookie)
        .expect(200);
      const userIds = response.body.data.map((user: { id: string }) => user.id);

      expect(userIds).toEqual(expect.arrayContaining([author.id, colleague.id]));
      expect(userIds).not.toContain(reviewer.id);
    });

    it("notifies each mentioned user who can read the forum, but not the author", async () => {
      const { user: author, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { user: target } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const { user: reviewer } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.REVIEWER);
      const { user: bystander } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const mentionOf = (user: UserWithCredentials) => `@${user.firstName} ${user.lastName}`;
      const mentionedUserIds = [target.id, target.id, author.id, reviewer.id, bystander.id];
      const content = `${mentionOf(target)} ${mentionOf(author)} ${mentionOf(reviewer)} please review`;

      const topic = await createTopic(cookie, {
        title: "Release notes",
        content,
        mentionedUserIds,
      });
      const replyResponse = await request(app.getHttpServer())
        .post(`/api/forum/topics/${topic.id}/posts`)
        .set("Cookie", cookie)
        .send({ content, mentionedUserIds })
        .expect(201);

      const mentionCalls = emitToRoom.mock.calls.filter(
        ([event]) => event === FORUM_SOCKET_EVENTS.USER_MENTIONED,
      );
      expect(mentionCalls).toEqual([
        [
          FORUM_SOCKET_EVENTS.USER_MENTIONED,
          `user:${target.id}`,
          { topicId: topic.id, postId: topic.firstPost.id },
        ],
        [
          FORUM_SOCKET_EVENTS.USER_MENTIONED,
          `user:${target.id}`,
          { topicId: topic.id, postId: replyResponse.body.data.id },
        ],
      ]);

      const mentionEvents = await db
        .select({ payload: outboxEvents.payload })
        .from(outboxEvents)
        .where(eq(outboxEvents.eventType, "ForumUserMentionedEvent"));
      expect(mentionEvents).toHaveLength(2);
      expect(mentionEvents[0].payload).toMatchObject({
        forumUserMentionedData: {
          topicId: topic.id,
          actorUserId: author.id,
          mentionedUserIds: [target.id],
        },
      });
    });

    it("rejects more mentions than a post may carry", async () => {
      const { cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const mentionedUserIds = Array.from({ length: FORUM_POST_MAX_MENTIONS + 1 }, () =>
        faker.string.uuid(),
      );

      await request(app.getHttpServer())
        .post("/api/forum/topics")
        .set("Cookie", cookie)
        .send({ title: "Everyone", content: "hi", mentionedUserIds })
        .expect(400);
    });
  });

  describe("live updates and domain events", () => {
    it("signals the forum and the topic and records an event for topics and replies", async () => {
      const { user: author, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const forumRoom = getForumRoom(author.tenantId);

      const topic = await createTopic(cookie, { title: "Roadmap", content: "What is next?" });
      expect(emitToRoom).toHaveBeenCalledWith(FORUM_SOCKET_EVENTS.CHANGED, forumRoom, {});

      emitToRoom.mockClear();
      const reply = await createReply(cookie, topic.id, "Forum reactions");
      expect(emitToRoom).toHaveBeenCalledWith(
        FORUM_SOCKET_EVENTS.TOPIC_CHANGED,
        getForumTopicRoom(topic.id),
        { topicId: topic.id },
      );
      expect(emitToRoom).toHaveBeenCalledWith(FORUM_SOCKET_EVENTS.CHANGED, forumRoom, {});

      const events = await db
        .select({ eventType: outboxEvents.eventType, payload: outboxEvents.payload })
        .from(outboxEvents)
        .where(
          inArray(outboxEvents.eventType, ["ForumTopicCreatedEvent", "ForumReplyCreatedEvent"]),
        );
      expect(events).toEqual(
        expect.arrayContaining([
          {
            eventType: "ForumTopicCreatedEvent",
            payload: {
              forumTopicCreatedData: {
                topicId: topic.id,
                postId: topic.firstPost.id,
                actorUserId: author.id,
              },
            },
          },
          {
            eventType: "ForumReplyCreatedEvent",
            payload: {
              forumReplyCreatedData: {
                topicId: topic.id,
                postId: reply.id,
                firstPostId: topic.firstPost.id,
                actorUserId: author.id,
                mentionedUserIds: [],
              },
            },
          },
        ]),
      );
    });

    it("signals the forum when a course discussion message is posted or deleted", async () => {
      const { user: student, cookie } = await createUserWithCookie(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await courseFactory.create({ authorId: student.id });
      await enroll(course.id, student);
      const forumChanged = [FORUM_SOCKET_EVENTS.CHANGED, getForumRoom(student.tenantId), {}];
      emitToRoom.mockClear();

      const courseThread = await createCourseThread(cookie, course.id, "Started in the course tab");
      expect(emitToRoom.mock.calls).toContainEqual(forumChanged);

      emitToRoom.mockClear();
      await request(app.getHttpServer())
        .delete(`/api/course-chat/messages/${courseThread.id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(emitToRoom.mock.calls).toContainEqual(forumChanged);
    });
  });
});
