import { faker } from "@faker-js/faker";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

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
  const createAnnouncementBody = (
    title = "Admin announcement",
    content = "Hello",
    groupId: string | null = null,
  ) => ({
    baseLanguage: SUPPORTED_LANGUAGES.EN,
    groupId,
    translations: [{ language: SUPPORTED_LANGUAGES.EN, title, content }],
  });

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
    await truncateTables(db, ["announcements", "user_announcements", "group_users", "groups"]);
  });

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
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

    it("returns announcement in requested language", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const adminCookies = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", adminCookies)
        .send({
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          groupId: null,
          translations: [
            {
              language: SUPPORTED_LANGUAGES.EN,
              title: "English title",
              content: "English content",
            },
            {
              language: SUPPORTED_LANGUAGES.PL,
              title: "Polski tytul",
              content: "Polska tresc",
            },
          ],
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/announcements")
        .query({ language: SUPPORTED_LANGUAGES.PL })
        .set("Cookie", adminCookies)
        .expect(200);

      expect(response.body.data[0].title).toBe("Polski tytul");
      expect(response.body.data[0].content).toBe("Polska tresc");
      expect(response.body.data[0].baseLanguage).toBe(SUPPORTED_LANGUAGES.EN);
      expect(response.body.data[0].availableLocales).toEqual(
        expect.arrayContaining([SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL]),
      );
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
        .send(createAnnouncementBody())
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
        .send(createAnnouncementBody("Content creator announcement"))
        .expect(201);
    });

    it("admin can create group-specific announcement", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const group = await groupFactory.create();

      const adminCookies = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", adminCookies)
        .send(createAnnouncementBody("Group announcement", "Hello group", group.id))
        .expect(201);
    });

    it("rejects announcement without base language translation", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const adminCookies = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", adminCookies)
        .send({
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          groupId: null,
          translations: [
            {
              language: SUPPORTED_LANGUAGES.PL,
              title: "Polski tytul",
              content: "Polska tresc",
            },
          ],
        })
        .expect(400);
    });

    it("rejects announcement with duplicate translation languages", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const adminCookies = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", adminCookies)
        .send({
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          groupId: null,
          translations: [
            { language: SUPPORTED_LANGUAGES.EN, title: "Title", content: "Content" },
            { language: SUPPORTED_LANGUAGES.EN, title: "Other title", content: "Other content" },
          ],
        })
        .expect(400);
    });

    it("rejects empty title and content", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const adminCookies = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", adminCookies)
        .send(createAnnouncementBody("", ""))
        .expect(400);
    });

    it("rejects title longer than 120 characters", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();

      const adminCookies = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", adminCookies)
        .send(createAnnouncementBody("a".repeat(121), "Content"))
        .expect(400);
    });

    it("student cannot create announcement (403)", async () => {
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      const studentCookies = await cookieFor(student, app);

      await request(app.getHttpServer())
        .post("/api/announcements")
        .set("Cookie", studentCookies)
        .send(createAnnouncementBody("Bad", "nope"))
        .expect(403);
    });
  });

  describe("PATCH /api/announcements/read-all", () => {
    it("user can mark all announcements as read", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      await announcementsFactory.withEveryone().create({ authorId: admin.id });
      await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const studentCookies = await cookieFor(student, app);

      const response = await request(app.getHttpServer())
        .patch("/api/announcements/read-all")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(response.body.data.updatedCount).toBe(2);

      const unreadResponse = await request(app.getHttpServer())
        .get("/api/announcements/unread")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(unreadResponse.body.data.unreadCount).toBe(0);
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

  describe("DELETE /api/announcements/:id", () => {
    it("admin can soft delete an announcement", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();

      const announcement = await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const adminCookies = await cookieFor(admin, app);
      const studentCookies = await cookieFor(student, app);

      await request(app.getHttpServer())
        .delete(`/api/announcements/${announcement.id}`)
        .set("Cookie", adminCookies)
        .expect(200);

      const userAnnouncementsResponse = await request(app.getHttpServer())
        .get("/api/announcements/user/me")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(userAnnouncementsResponse.body.data).toHaveLength(0);

      const unreadResponse = await request(app.getHttpServer())
        .get("/api/announcements/unread")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(unreadResponse.body.data.unreadCount).toBe(0);
    });

    it("student cannot delete announcement", async () => {
      const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create();
      const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();
      const announcement = await announcementsFactory.withEveryone().create({ authorId: admin.id });

      const studentCookies = await cookieFor(student, app);

      await request(app.getHttpServer())
        .delete(`/api/announcements/${announcement.id}`)
        .set("Cookie", studentCookies)
        .expect(403);
    });
  });
});
