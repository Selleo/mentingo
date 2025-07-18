import { omit } from "lodash";
import request from "supertest";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor } from "../../../test/helpers/test-helpers";
import { AuthService } from "../../auth/auth.service";

import type { DatabasePg } from "../../common";
import type { INestApplication } from "@nestjs/common";

describe("UsersController (e2e)", () => {
  let app: INestApplication;
  let authService: AuthService;
  let testUser: UserWithCredentials;
  let testCookies: string;
  const testPassword = "password123";
  let db: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    authService = app.get(AuthService);
    db = app.get("DB");
    userFactory = createUserFactory(db);
  }, 10000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  beforeEach(async () => {
    testUser = await userFactory
      .withCredentials({ password: testPassword })
      .withAdminRole()
      .create();

    testCookies = await cookieFor(testUser, app);
  });

  describe("GET /user/all", () => {
    it("should return all users", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/user/all")
        .set("Cookie", testCookies)
        .expect(200);

      expect(response.body.data).toEqual(
        expect.arrayContaining([expect.objectContaining(omit(testUser, "credentials"))]),
      );
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe("GET /user?id=:id", () => {
    it("should return a user by id", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/user?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .expect(200);

      expect(response.body.data).toBeDefined();

      expect(response.body.data).toStrictEqual(omit(testUser, "credentials"));
    });

    it("should return 404 for non-existent user", async () => {
      await request(app.getHttpServer())
        .get(`/api/user?id=${crypto.randomUUID()}`)
        .set("Cookie", testCookies)
        .expect(404);
    });
  });

  describe("PATCH ?id=:id", () => {
    it("should update user", async () => {
      const updateData = { email: "newemail@example.com" };
      const response = await request(app.getHttpServer())
        .patch(`/api/user?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .send(updateData)
        .expect(200);

      expect(response.body.data.email).toBe(updateData.email);
    });

    it("should return 403 when updating another user", async () => {
      const anotherUser = await authService.register({
        email: "another@example.com",
        password: "password123",
        firstName: "Another",
        lastName: "User",
      });
      await request(app.getHttpServer())
        .patch(`/api/user?id=${anotherUser.id}`)
        .set("Cookie", testCookies)
        .send({ email: "newemail@example.com" })
        .expect(403);
    });
  });

  describe("PATCH /user/change-password?id=:id", () => {
    it("should change password when old password is correct", async () => {
      const newPassword = "newPassword123@";

      await request(app.getHttpServer())
        .patch(`/api/user/change-password?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .send({ oldPassword: testPassword, newPassword })
        .expect(200);

      const loginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(201);

      expect(loginResponse.headers["set-cookie"]).toBeDefined();
    });

    it("should return 401 when old password is incorrect", async () => {
      const incorrectOldPassword = "wrongPassword";
      const newPassword = "newPassword123@";

      await request(app.getHttpServer())
        .patch(`/api/user/change-password?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .send({ oldPassword: incorrectOldPassword, newPassword })
        .expect(401);
    });

    it("should return 403 when changing another user's password", async () => {
      const anotherUser = await authService.register({
        email: "another2@example.com",
        password: "Password123@",
        firstName: "Another",
        lastName: "User",
      });

      await request(app.getHttpServer())
        .patch(`/api/user/change-password?id=${anotherUser.id}`)
        .set("Cookie", testCookies)
        .send({ oldPassword: "Password123@", newPassword: "Password2137@" })
        .expect(403);
    });
  });

  describe("DELETE /user/user?id=:id", () => {
    it("should delete user", async () => {
      await request(app.getHttpServer())
        .delete(`/api/user/user?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/user/user?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .expect(404);
    });

    it("should return 403 when deleting another user", async () => {
      const anotherUser = await authService.register({
        email: "another3@example.com",
        password: "password123",
        firstName: "Another",
        lastName: "User",
      });
      await request(app.getHttpServer())
        .delete(`/api/user/user?id=${anotherUser.id}`)
        .set("Cookie", testCookies)
        .expect(403);
    });
  });
  describe("GET /user/details?userId=:id", () => {
    let cookies: string;

    beforeAll(async () => {
      const anotherUser = await authService.register({
        email: "another4@example.com",
        password: testPassword,
        firstName: "Another",
        lastName: "User",
      });
      const loginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: anotherUser.email,
          password: testPassword,
        })
        .expect(201);

      cookies = loginResponse.headers["set-cookie"];
    });
    it("should return user details", async () => {
      await request(app.getHttpServer())
        .get(`/api/user/details?userId=${testUser.id}`)
        .set("Cookie", cookies)
        .expect(200);
    });

    it("should return forbidden", async () => {
      const anotherUser2 = await authService.register({
        email: "another5@example.com",
        password: testPassword,
        firstName: "Another",
        lastName: "User",
      });
      await request(app.getHttpServer())
        .get(`/api/user/details?userId=${anotherUser2.id}`)
        .set("Cookie", cookies)
        .expect(403);
    });
  });
});
