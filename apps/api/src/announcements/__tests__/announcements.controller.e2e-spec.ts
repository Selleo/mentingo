import { faker } from "@faker-js/faker";
import { and, desc, eq } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { announcements, groupAnnouncements, userAnnouncements } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createAnnouncementFactory } from "../../../test/factory/announcement.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateAllTables, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("AnnouncementsController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let announcementsFactory: ReturnType<typeof createAnnouncementFactory>;

  const password = "Password123@";
  const createAdmin = () => userFactory.withCredentials({ password }).withAdminSettings(db).create();
  const createStudent = () => userFactory.withCredentials({ password }).withUserSettings(db).create();
  const loginCookieFor = async (user: { email: string; credentials?: { password?: string } }) => {
    const response = await request(app.getHttpServer()).post("/api/auth/login").send({
      email: user.email,
      password: user.credentials?.password,
    });

    const cookies = response.headers["set-cookie"];

    if (!cookies) {
      throw new Error(
        `Failed to login ${user.email}. Status: ${response.status}. Body: ${JSON.stringify(response.body)}`,
      );
    }

    return cookies;
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);

    userFactory = createUserFactory(db);
    groupFactory = createGroupFactory(db);
    announcementsFactory = createAnnouncementFactory(db);
  });

  afterEach(async () => {
    await truncateTables(db, [
      "announcements",
      "user_announcements",
      "group_announcements",
      "group_users",
      "groups",
    ]);
  });

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
  });

  describe("GET /api/announcements", () => {
    it("returns announcements ordered by newest first and matching persisted records", async () => {
      const author = await createAdmin();
      const viewer = await createAdmin();
      const viewerCookies = await loginCookieFor(viewer);
      const olderTimestamp = "2026-04-01T10:00:00.000Z";
      const newerTimestamp = "2026-04-01T11:00:00.000Z";

      const older = await announcementsFactory.withEveryone().create({
        authorId: author.id,
        title: "Older announcement",
        content: "Older content",
        createdAt: olderTimestamp,
        updatedAt: olderTimestamp,
      });

      const newer = await announcementsFactory.withEveryone().create({
        authorId: author.id,
        title: "Newer announcement",
        content: "Newer content",
        createdAt: newerTimestamp,
        updatedAt: newerTimestamp,
      });

      const response = await request(app.getHttpServer())
        .get("/api/announcements")
        .set("Cookie", viewerCookies)
        .expect(200);

      const dbRows = await db.select().from(announcements).orderBy(desc(announcements.createdAt));

      expect(response.body.data.map((item: { id: string }) => item.id)).toEqual(dbRows.map((r) => r.id));
      expect(response.body.data.map((item: { id: string }) => item.id)).toEqual([newer.id, older.id]);
      expect(response.body.data[0]).toMatchObject({
        id: newer.id,
        title: "Newer announcement",
        content: "Newer content",
        authorId: author.id,
        isEveryone: true,
        authorName: `${author.firstName} ${author.lastName}`,
      });
      expect(response.body.data[1]).toMatchObject({
        id: older.id,
        title: "Older announcement",
        content: "Older content",
      });
    });

    it("allows students to fetch all announcements with exact DB parity", async () => {
      const author = await createAdmin();
      const student = await createStudent();

      await announcementsFactory.withEveryone().create({
        authorId: author.id,
        title: "First",
      });
      await announcementsFactory.withEveryone().create({
        authorId: author.id,
        title: "Second",
      });
      await announcementsFactory.withEveryone().create({
        authorId: author.id,
        title: "Third",
      });

      const response = await request(app.getHttpServer())
        .get("/api/announcements")
        .set("Cookie", await loginCookieFor(student))
        .expect(200);

      const dbRows = await db.select().from(announcements).orderBy(desc(announcements.createdAt));

      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.map((item: { id: string }) => item.id)).toEqual(dbRows.map((r) => r.id));
    });

    it("unauthenticated request returns 401", async () => {
      await request(app.getHttpServer()).get("/api/announcements").expect(401);
    });
  });

  describe("GET /api/announcements/latest", () => {
    it("returns only unread announcements, limited to top 3 and sorted descending", async () => {
      const author = await createAdmin();
      const student = await createStudent();
      const baseTime = new Date("2026-04-10T10:00:00.000Z").getTime();
      const createdAnnouncements = [] as string[];

      for (let i = 0; i < 4; i++) {
        const timestamp = new Date(baseTime + i * 60_000).toISOString();
        const created = await announcementsFactory.withEveryone().create({
          authorId: author.id,
          title: `Announcement ${i}`,
          content: `Content ${i}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        createdAnnouncements.push(created.id);
      }

      const newestAnnouncementId = createdAnnouncements[3];
      await db
        .update(userAnnouncements)
        .set({ isRead: true })
        .where(
          and(
            eq(userAnnouncements.userId, student.id),
            eq(userAnnouncements.announcementId, newestAnnouncementId),
          ),
        );

      const response = await request(app.getHttpServer())
        .get("/api/announcements/latest")
        .set("Cookie", await loginCookieFor(student))
        .expect(200);

      const expected = await db
        .select({ id: announcements.id })
        .from(announcements)
        .leftJoin(
          userAnnouncements,
          and(
            eq(announcements.id, userAnnouncements.announcementId),
            eq(userAnnouncements.userId, student.id),
          ),
        )
        .where(eq(userAnnouncements.isRead, false))
        .orderBy(desc(announcements.createdAt))
        .limit(3);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.map((item: { id: string }) => item.id)).toEqual(
        expected.map((item) => item.id),
      );
    });

    it("returns empty array if no unread announcements", async () => {
      const student = await createStudent();

      const response = await request(app.getHttpServer())
        .get("/api/announcements/latest")
        .set("Cookie", await loginCookieFor(student))
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it("returns empty array for admin user", async () => {
      const admin = await createAdmin();
      const author = await createAdmin();

      await announcementsFactory.withEveryone().create({ authorId: author.id });
      await announcementsFactory.withEveryone().create({ authorId: author.id });

      const response = await request(app.getHttpServer())
        .get("/api/announcements/latest")
        .set("Cookie", await loginCookieFor(admin))
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it("unauthenticated request returns 401", async () => {
      await request(app.getHttpServer()).get("/api/announcements/latest").expect(401);
    });
  });

  describe("GET /api/announcements/unread", () => {
    it("returns unread count exactly as stored in user_announcements", async () => {
      const author = await createAdmin();
      const student = await createStudent();
      const first = await announcementsFactory.withEveryone().create({ authorId: author.id });
      await announcementsFactory.withEveryone().create({ authorId: author.id });

      await db
        .update(userAnnouncements)
        .set({ isRead: true })
        .where(
          and(
            eq(userAnnouncements.userId, student.id),
            eq(userAnnouncements.announcementId, first.id),
          ),
        );

      const response = await request(app.getHttpServer())
        .get("/api/announcements/unread")
        .set("Cookie", await loginCookieFor(student))
        .expect(200);

      const expectedUnreadCount = await db
        .select()
        .from(userAnnouncements)
        .where(and(eq(userAnnouncements.userId, student.id), eq(userAnnouncements.isRead, false)));

      expect(response.body.data.unreadCount).toBe(expectedUnreadCount.length);
    });

    it("unauthenticated request returns 401", async () => {
      await request(app.getHttpServer()).get("/api/announcements/unread").expect(401);
    });
  });

  describe("GET /api/announcements/user/me", () => {
    it("returns only announcements assigned to current user with accurate read flags", async () => {
      const admin = await createAdmin();
      const student = await createStudent();
      const unrelatedStudent = await createStudent();
      const studentGroup = await groupFactory.withMembers([student.id]).create();
      const unrelatedGroup = await groupFactory.withMembers([unrelatedStudent.id]).create();

      const everyoneAnnouncement = await announcementsFactory.withEveryone().create({
        authorId: admin.id,
        title: "Global announcement",
      });
      await announcementsFactory.withGroup(studentGroup.id).create({
        authorId: admin.id,
        title: "Student group announcement",
      });
      const unrelatedAnnouncement = await announcementsFactory.withGroup(unrelatedGroup.id).create({
        authorId: admin.id,
        title: "Unrelated group announcement",
      });

      await db
        .update(userAnnouncements)
        .set({ isRead: true })
        .where(
          and(
            eq(userAnnouncements.userId, student.id),
            eq(userAnnouncements.announcementId, everyoneAnnouncement.id),
          ),
        );

      const response = await request(app.getHttpServer())
        .get("/api/announcements/user/me")
        .set("Cookie", await loginCookieFor(student))
        .expect(200);

      const expectedRows = await db
        .select({
          announcementId: userAnnouncements.announcementId,
          isRead: userAnnouncements.isRead,
        })
        .from(userAnnouncements)
        .where(eq(userAnnouncements.userId, student.id));

      expect(response.body.data).toHaveLength(expectedRows.length);
      expect(response.body.data.some((a: { id: string }) => a.id === unrelatedAnnouncement.id)).toBe(
        false,
      );

      const expectedMap = new Map(expectedRows.map((row) => [row.announcementId, row.isRead]));
      for (const item of response.body.data as Array<{ id: string; isRead: boolean }>) {
        expect(item.isRead).toBe(expectedMap.get(item.id));
      }
    });

    it("supports read-state filtering", async () => {
      const admin = await createAdmin();
      const student = await createStudent();
      const first = await announcementsFactory.withEveryone().create({
        authorId: admin.id,
        title: "Needs read filter",
      });
      const second = await announcementsFactory.withEveryone().create({
        authorId: admin.id,
        title: "Still unread",
      });

      await db
        .update(userAnnouncements)
        .set({ isRead: true })
        .where(
          and(
            eq(userAnnouncements.userId, student.id),
            eq(userAnnouncements.announcementId, first.id),
          ),
        );

      const response = await request(app.getHttpServer())
        .get("/api/announcements/user/me?isRead=true")
        .set("Cookie", await loginCookieFor(student))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(first.id);
      expect(response.body.data[0].isRead).toBe(true);
      expect(response.body.data[0].id).not.toBe(second.id);
    });

    it("unauthenticated request returns 401", async () => {
      await request(app.getHttpServer()).get("/api/announcements/user/me").expect(401);
    });
  });

  describe("POST /api/announcements", () => {
    it("admin can create everyone announcement and it is persisted with recipient records", async () => {
      const admin = await createAdmin();
      const student = await createStudent();
      const contentCreator = await userFactory
        .withCredentials({ password })
        .withContentCreatorSettings(db)
        .create();

      const payload = { title: "Admin announcement", content: "Hello", groupId: null };
      const response = await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", await loginCookieFor(admin))
        .send(payload)
        .expect(201);

      const [storedAnnouncement] = await db
        .select()
        .from(announcements)
        .where(eq(announcements.id, response.body.data.id));
      const announcementRecipients = await db
        .select({
          userId: userAnnouncements.userId,
          isRead: userAnnouncements.isRead,
        })
        .from(userAnnouncements)
        .where(eq(userAnnouncements.announcementId, response.body.data.id));

      expect(storedAnnouncement).toMatchObject({
        title: payload.title,
        content: payload.content,
        authorId: admin.id,
        isEveryone: true,
      });
      expect(announcementRecipients.map((row) => row.userId)).toEqual(
        expect.arrayContaining([student.id, contentCreator.id]),
      );
      expect(announcementRecipients.map((row) => row.userId)).not.toContain(admin.id);
      expect(announcementRecipients.every((row) => row.isRead === false)).toBe(true);
    });

    it("content creator can create announcement", async () => {
      const creator = await userFactory
        .withCredentials({ password })
        .withContentCreatorSettings(db)
        .create();

      const creatorCookies = await loginCookieFor(creator);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", creatorCookies)
        .send({ title: "Content creator announcement", content: "Hello", groupId: null })
        .expect(201);
    });

    it("admin can create group-specific announcement and only non-managing group members receive it", async () => {
      const admin = await createAdmin();
      const student = await createStudent();
      const secondAdmin = await createAdmin();
      const group = await groupFactory.withMembers([student.id, secondAdmin.id]).create();

      const response = await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", await loginCookieFor(admin))
        .send({ title: "Group announcement", content: "Hello group", groupId: group.id })
        .expect(201);

      const [storedGroupLink] = await db
        .select()
        .from(groupAnnouncements)
        .where(eq(groupAnnouncements.announcementId, response.body.data.id));
      const recipients = await db
        .select({ userId: userAnnouncements.userId })
        .from(userAnnouncements)
        .where(eq(userAnnouncements.announcementId, response.body.data.id));

      expect(storedGroupLink.groupId).toBe(group.id);
      expect(recipients.map((row) => row.userId)).toEqual([student.id]);
    });

    it("student cannot create announcement (403)", async () => {
      const student = await createStudent();

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", await loginCookieFor(student))
        .send({ title: "Bad", content: "nope", groupId: null })
        .expect(403);
    });
  });

  describe("PATCH /api/announcements/:id/read", () => {
    it("marks announcement as read and keeps operation idempotent", async () => {
      const admin = await createAdmin();
      const student = await createStudent();
      const announcement = await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const firstResponse = await request(app.getHttpServer())
        .patch(`/api/announcements/${announcement.id}/read`)
        .set("Cookie", await loginCookieFor(student))
        .expect(200);

      expect(firstResponse.body.data).toMatchObject({
        announcementId: announcement.id,
        userId: student.id,
        isRead: true,
      });

      const [storedAfterFirstRead] = await db
        .select()
        .from(userAnnouncements)
        .where(
          and(
            eq(userAnnouncements.announcementId, announcement.id),
            eq(userAnnouncements.userId, student.id),
          ),
        );
      expect(storedAfterFirstRead.isRead).toBe(true);

      const secondResponse = await request(app.getHttpServer())
        .patch(`/api/announcements/${announcement.id}/read`)
        .set("Cookie", await loginCookieFor(student))
        .expect(200);
      expect(secondResponse.body.data).toMatchObject({
        announcementId: announcement.id,
        userId: student.id,
        isRead: true,
      });

      const unreadCountResponse = await request(app.getHttpServer())
        .get("/api/announcements/unread")
        .set("Cookie", await loginCookieFor(student))
        .expect(200);
      expect(unreadCountResponse.body.data.unreadCount).toBe(0);
    });

    it("marking non-existent announcement returns 400 with explicit message", async () => {
      const student = await createStudent();
      const randomId = faker.string.uuid();

      const response = await request(app.getHttpServer())
        .patch(`/api/announcements/${randomId}/read`)
        .set("Cookie", await loginCookieFor(student))
        .expect(400);

      expect(response.body.message).toBe("Announcement not found");
    });
  });
});
