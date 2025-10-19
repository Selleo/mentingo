import request from "supertest";
import { v4 as uuidv4 } from "uuid";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";
import { DEFAULT_PAGE_SIZE } from "../../common/pagination";
import { groupUsers } from "../../storage/schema";
import { USER_ROLES } from "../../user/schemas/userRoles";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("groupController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  const password = "password123";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get("DB");
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    groupFactory = createGroupFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateAllTables(db);
  });

  describe("GET /api/group/all", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).get("/api/group/all").expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);

        await request(app.getHttpServer()).get("/api/group/all").set("Cookie", cookies).expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);

        await request(app.getHttpServer()).get("/api/group/all").set("Cookie", cookies).expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("returns all groups", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group = await groupFactory.create();

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(group.id);
        expect(response.body.data[0].name).toBe(group.name);
        expect(response.body.data[0].characteristic).toBe(null);
        expect(response.body.pagination.totalItems).toBe(1);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.perPage).toBe(DEFAULT_PAGE_SIZE);
      });

      it("returns all groups with pagination", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        await groupFactory.create();
        const group2 = await groupFactory.create();

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .query({ perPage: 1, page: 2 })
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(group2.id);
      });

      it("returns all groups with sorting by name", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group1 = await groupFactory.create({ name: "B" });
        const group2 = await groupFactory.create({ name: "A" });

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .query({ sort: "name" })
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].id).toBe(group2.id);
        expect(response.body.data[1].id).toBe(group1.id);
      });

      it("returns all groups with sorting by created at", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group1 = await groupFactory.create({ name: "B" });
        const group2 = await groupFactory.create({ name: "A" });

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .query({ sort: "createdAt" })
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].id).toBe(group1.id);
        expect(response.body.data[1].id).toBe(group2.id);
      });

      it("returns all groups with filtering by keyword", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        await groupFactory.create({ name: "B" });
        const group1 = await groupFactory.create({ name: "AB" });
        const group2 = await groupFactory.create({ name: "A" });

        const response = await request(app.getHttpServer())
          .get("/api/group/all")
          .set("Cookie", cookies)
          .query({ keyword: "A" })
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].id).toBe(group1.id);
        expect(response.body.data[1].id).toBe(group2.id);
      });
    });
  });

  describe("GET /api/group/:groupId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const group = await groupFactory.create();

        await request(app.getHttpServer()).get(`/api/group/${group.id}`).expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .get(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .get(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("returns group", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group = await groupFactory.create();

        const response = await request(app.getHttpServer())
          .get(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.id).toBe(group.id);
        expect(response.body.data.name).toBe(group.name);
        expect(response.body.data.characteristic).toBe(null);
      });
    });
  });

  describe("GET /api/group/user/:userId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const user = await userFactory.create();

        await request(app.getHttpServer()).get(`/api/group/user/${user.id}`).expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const user = await userFactory.create();

        await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const user = await userFactory.create();

        await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("returns user groups", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const user = await userFactory.create();
        const group = await groupFactory.create();
        await db.insert(groupUsers).values({ userId: user.id, groupId: group.id });

        const response = await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(group.id);
        expect(response.body.data[0].name).toBe(group.name);
        expect(response.body.data[0].characteristic).toBe(null);
        expect(response.body.pagination.totalItems).toBe(1);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.perPage).toBe(DEFAULT_PAGE_SIZE);
      });

      it("returns user groups with pagination", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const user = await userFactory.create();
        const group = await groupFactory.create();
        await db.insert(groupUsers).values({ userId: user.id, groupId: group.id });

        const response = await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .query({ perPage: 1, page: 2 })
          .expect(200);

        expect(response.body.data).toHaveLength(0);
      });

      it("returns user groups with filtering by keyword", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const user = await userFactory.create();
        const group = await groupFactory.create({ name: "A" });
        await groupFactory.create({ name: "B" });
        await db.insert(groupUsers).values({ userId: user.id, groupId: group.id });

        const response = await request(app.getHttpServer())
          .get(`/api/group/user/${user.id}`)
          .set("Cookie", cookies)
          .query({ keyword: "B" })
          .expect(200);

        expect(response.body.data).toHaveLength(0);
      });
    });
  });

  describe("POST /api/group", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .post("/api/group")
          .send({ name, characteristic })
          .expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .post("/api/group")
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .post("/api/group")
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("creates a group", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .post("/api/group")
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(201);
      });
    });
  });

  describe("PATCH /api/group/:groupId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const group = await groupFactory.create();
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .patch(`/api/group/${group.id}`)
          .send({ name, characteristic })
          .expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .patch(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .patch(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("updates a group", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group = await groupFactory.create();
        const name = "Programmers";
        const characteristic = "People who love programming";

        const response = await request(app.getHttpServer())
          .patch(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(200);

        expect(response.body.data.id).toBe(group.id);
        expect(response.body.data.name).toBe(name);
        expect(response.body.data.characteristic).toBe(characteristic);
      });

      it("returns 404 if group does not exist", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const name = "Programmers";
        const characteristic = "People who love programming";

        await request(app.getHttpServer())
          .patch(`/api/group/${uuidv4()}`)
          .set("Cookie", cookies)
          .send({ name, characteristic })
          .expect(404);
      });
    });
  });

  describe("DELETE /api/group/:groupId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        const group = await groupFactory.create();

        await request(app.getHttpServer()).delete(`/api/group/${group.id}`).expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .delete(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .delete(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("deletes a group", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group = await groupFactory.create();

        await request(app.getHttpServer())
          .delete(`/api/group/${group.id}`)
          .set("Cookie", cookies)
          .expect(200);
      });

      it("returns 404 if group does not exist", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);

        await request(app.getHttpServer())
          .delete(`/api/group/${uuidv4()}`)
          .set("Cookie", cookies)
          .expect(404);
      });
    });
  });

  describe("DELETE /api/group", () => {
    describe("when user is not logged in", () => {
      it("returns 401 if user is not logged in", async () => {
        await request(app.getHttpServer()).delete("/api/group").expect(401);
      });
    });

    describe("when user is logged in as a non-admin", () => {
      it("returns 403 if user is a student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);

        await request(app.getHttpServer()).delete("/api/group").set("Cookie", cookies).expect(403);
      });

      it("returns 403 if user is a content creator", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const cookies = await cookieFor(student, app);

        await request(app.getHttpServer()).delete("/api/group").set("Cookie", cookies).expect(403);
      });
    });

    describe("when user is logged in as an admin", () => {
      it("deletes groups", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);
        const group1 = await groupFactory.create();
        const group2 = await groupFactory.create();

        await request(app.getHttpServer())
          .delete("/api/group")
          .set("Cookie", cookies)
          .send([group1.id, group2.id])
          .expect(200);
      });

      it("returns 400 if groups array is empty", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const cookies = await cookieFor(admin, app);

        await request(app.getHttpServer())
          .delete("/api/group")
          .set("Cookie", cookies)
          .send({ groupIds: [] })
          .expect(400);
      });
    });
  });
});
