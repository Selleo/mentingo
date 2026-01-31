import { faker } from "@faker-js/faker";
import request from "supertest";

import { DB, DB_BASE } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createAnnouncementFactory } from "../../../test/factory/announcement.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateTables, truncateAllTables, cookieFor } from "../../../test/helpers/test-helpers";

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

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_BASE);

    userFactory = createUserFactory(db);
    groupFactory = createGroupFactory(db);
    announcementsFactory = createAnnouncementFactory(db);
  });

  afterEach(async () => {
    await truncateTables(db, ["announcements", "user_announcements", "group_users", "groups"]);
  });

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
  });

  describe("GET /api/announcements", () => {
    it("admin can fetch all announcements", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const adminCookies = await cookieFor(admin, app);

      const response = await request(app.getHttpServer())
        .get("/api/announcements")
        .set("Cookie", adminCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("student can fetch all announcements", async () => {
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      await announcementsFactory.withEveryone().create({ authorId: student.id });
      await announcementsFactory.withEveryone().create({ authorId: student.id });
      await announcementsFactory.withEveryone().create({ authorId: student.id });

      const studentCookies = await cookieFor(student, app);

      const response = await request(app.getHttpServer())
        .get("/api/announcements")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(3);
    });

    it("unauthenticated request returns 401", async () => {
      await request(app.getHttpServer()).get("/api/announcements").expect(401);
    });
  });

  describe("GET /api/announcements/latest", () => {
    it("returns latest unread announcements for user", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const studentCookies = await cookieFor(student, app);

      const response = await request(app.getHttpServer())
        .get("/api/announcements/latest")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("returns empty array if no unread announcements", async () => {
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      const studentCookies = await cookieFor(student, app);

      const response = await request(app.getHttpServer())
        .get("/api/announcements/latest")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });

    it("returns empty array for admin user", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const adminCookies = await cookieFor(admin, app);

      await announcementsFactory.withEveryone().create({ authorId: admin.id });
      await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const response = await request(app.getHttpServer())
        .get("/api/announcements/latest")
        .set("Cookie", adminCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });

    it("unauthenticated request returns 401", async () => {
      await request(app.getHttpServer()).get("/api/announcements/latest").expect(401);
    });
  });

  describe("GET /api/announcements/unread", () => {
    it("returns unread count for a user", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const studentCookies = await cookieFor(student, app);

      const response = await request(app.getHttpServer())
        .get("/api/announcements/unread")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(typeof response.body.data.unreadCount).toBe("number");
    });

    it("unauthenticated request returns 401", async () => {
      await request(app.getHttpServer()).get("/api/announcements/unread").expect(401);
    });
  });

  describe("GET /api/announcements/user/me", () => {
    it("returns announcements for the current user", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const studentCookies = await cookieFor(student, app);
      const response = await request(app.getHttpServer())
        .get("/api/announcements/user/me")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("returns empty array for user with no announcements", async () => {
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      const studentCookies = await cookieFor(student, app);

      const response = await request(app.getHttpServer())
        .get("/api/announcements/user/me")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });

    it("stundent sees announcements for his groups", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();
      const group = await groupFactory.withMembers([student.id]).create();

      await announcementsFactory.withGroup(group.id).create({ authorId: admin.id });
      await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const studentCookies = await cookieFor(student, app);

      const response = await request(app.getHttpServer())
        .get("/api/announcements/user/me")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it("student does not see announcements for other groups", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();
      const group = await groupFactory.create();

      await announcementsFactory.withGroup(group.id).create({ authorId: admin.id });
      await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const studentCookies = await cookieFor(student, app);

      const response = await request(app.getHttpServer())
        .get("/api/announcements/user/me")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
    });

    it("unauthenticated request returns 401", async () => {
      await request(app.getHttpServer()).get("/api/announcements/user/me").expect(401);
    });
  });

  describe("POST /api/announcements", () => {
    it("admin can create announcement", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const adminCookies = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", adminCookies)
        .send({ title: "Admin announcement", content: "Hello", groupId: null })
        .expect(201);
    });

    it("content creator can create announcement", async () => {
      const creator = await userFactory
        .withCredentials({ password })
        .withContentCreatorSettings(db)
        .create();

      const creatorCookies = await cookieFor(creator, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", creatorCookies)
        .send({ title: "Content creator announcement", content: "Hello", groupId: null })
        .expect(201);
    });

    it("admin can create group-specific announcement", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const group = await groupFactory.create();

      const adminCookies = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", adminCookies)
        .send({ title: "Group announcement", content: "Hello group", groupId: group.id })
        .expect(201);
    });

    it("student cannot create announcement (403)", async () => {
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      const studentCookies = await cookieFor(student, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", studentCookies)
        .send({ title: "Bad", content: "nope", groupId: null })
        .expect(403);
    });
  });

  describe("PATCH /api/announcements/:id/read", () => {
    it("user can mark announcement as read", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      const announcement = await announcementsFactory.withEveryone().create({
        authorId: admin.id,
      });

      const studentCookies = await cookieFor(student, app);

      await request(app.getHttpServer())
        .patch(`/api/announcements/${announcement.id}/read`)
        .set("Cookie", studentCookies)
        .expect(200);
    });

    it("marking non-existent announcement returns 404", async () => {
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      const studentCookies = await cookieFor(student, app);

      const randomId = faker.string.uuid();

      await request(app.getHttpServer())
        .patch(`/api/announcements/${randomId}/read`)
        .set("Cookie", studentCookies)
        .expect(400);
    });
  });
});
