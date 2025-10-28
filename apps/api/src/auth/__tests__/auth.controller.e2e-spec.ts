import * as cookie from "cookie";
import { isArray, omit } from "lodash";
import request from "supertest";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { AuthService } from "../auth.service";

import type { DatabasePg } from "../../common/index";
import type { INestApplication } from "@nestjs/common";

describe("AuthController (e2e)", () => {
  let app: INestApplication;
  let authService: AuthService;
  let db: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    authService = app.get(AuthService);
    db = app.get("DB");
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateTables(db, ["settings"]);
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const user = await userFactory.withCredentials({ password: "Password123@" }).build();

      const response = await request(app.getHttpServer())
        .post("/api/auth/register")
        .set("Accept", "application/json")
        .set("Content-Type", "application/json")
        .send({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          password: user.credentials?.password,
        });

      expect(response.status).toEqual(201);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.email).toBe(user.email);
    });

    it("should return 409 if user already exists", async () => {
      const existingUser = {
        email: "existing@example.com",
        password: "Password123@",
        firstName: "Tyler",
        lastName: "Durden",
      };

      await authService.register(existingUser);

      await request(app.getHttpServer()).post("/api/auth/register").send(existingUser).expect(409);
    });

    it("should return 400 if password does not match criteria", async () => {
      const user = await userFactory.withCredentials({ password: "passnotmatchcriteria" }).build();

      const response = await request(app.getHttpServer())
        .post("/api/auth/register")
        .send(user)
        .expect(400);
      expect(response.body.message).toEqual("Validation failed (body)");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login and return user data with cookies", async () => {
      const user = await userFactory
        .withCredentials({
          password: "Password123@",
        })
        .withUserSettings(db)
        .create({
          email: "test@example.com",
        });

      const response = await request(app.getHttpServer()).post("/api/auth/login").send({
        email: user.email,
        password: user.credentials?.password,
      });

      expect(response.status).toEqual(201);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.email).toBe(user.email);
      expect(response.headers["set-cookie"]).toBeDefined();
      expect(response.headers["set-cookie"].length).toBe(2);
    });

    it("should return 401 for invalid credentials", async () => {
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: "wrong@example.com",
          password: "wrongpassword",
        })
        .expect(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear token cookies for a logged-in user", async () => {
      let accessToken = "";

      const user = userFactory.build();
      const password = "Password123@";
      await authService.register({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password,
      });

      const loginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
        email: user.email,
        password: password,
      });

      const cookies = loginResponse.headers["set-cookie"];

      if (Array.isArray(cookies)) {
        cookies.forEach((cookieString) => {
          const parsedCookie = cookie.parse(cookieString);
          if ("access_token" in parsedCookie) {
            accessToken = parsedCookie.access_token;
          }
        });
      }

      const logoutResponse = await request(app.getHttpServer())
        .post("/api/auth/logout")
        .set("Cookie", `access_token=${accessToken};`);

      const logoutCookies = logoutResponse.headers["set-cookie"];

      expect(loginResponse.status).toBe(201);
      expect(logoutResponse.status).toBe(201);
      expect(logoutResponse.headers["set-cookie"]).toBeDefined();
      expect(logoutCookies.length).toBe(2);
      expect(logoutCookies[0]).toContain("access_token=;");
      expect(logoutCookies[1]).toContain("refresh_token=;");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh tokens", async () => {
      const user = await userFactory.build();
      const password = "Password123@";

      await authService.register({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password,
      });

      let refreshToken = "";

      const loginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: password,
        })
        .expect(201);

      const cookies = loginResponse.headers["set-cookie"];

      if (isArray(cookies)) {
        cookies.forEach((cookie) => {
          if (cookie.startsWith("refresh_token=")) {
            refreshToken = cookie;
          }
        });
      }

      const response = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", [refreshToken])
        .expect(201);

      expect(response.headers["set-cookie"]).toBeDefined();
      expect(response.headers["set-cookie"].length).toBe(2);
    });

    it("should return 401 for invalid refresh token", async () => {
      await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .set("Cookie", ["refreshToken=invalid_token"])
        .expect(401);
    });
  });

  describe("GET /api/auth/current-user", () => {
    it("should return current user data for authenticated user", async () => {
      let accessToken = "";

      const user = await userFactory
        .withCredentials({ password: "Password123@" })
        .withUserSettings(db)
        .create();

      const loginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
        email: user.email,
        password: "Password123@",
      });

      const cookies = loginResponse.headers["set-cookie"];

      if (Array.isArray(cookies)) {
        cookies.forEach((cookieString) => {
          const parsedCookie = cookie.parse(cookieString);
          if ("access_token" in parsedCookie) {
            accessToken = parsedCookie.access_token;
          }
        });
      }

      const response = await request(app.getHttpServer())
        .get("/api/auth/current-user")
        .set("Cookie", `access_token=${accessToken};`)
        .expect(200);

      const { onboardingStatus: _, ...currentUser } = response.body.data;

      expect(currentUser).toStrictEqual({
        ...omit(user, "credentials", "avatarReference"),
        profilePictureUrl: null,
        groupName: null,
        groupId: null,
        shouldVerifyMFA: false,
      });
    });

    it("should return 401 for unauthenticated request", async () => {
      await request(app.getHttpServer()).get("/api/auth/current-user").expect(401);
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("should send a password reset link if email exists", async () => {
      const user = await userFactory
        .withCredentials({
          password: "Password123@",
        })
        .create({
          email: "test_2@example.com",
        });

      const response = await request(app.getHttpServer())
        .post("/api/auth/forgot-password")
        .send({ email: user.email })
        .expect(201);

      expect(response.body.data).toEqual({
        message: "Password reset link sent",
      });
    });

    it("should return 404 if email is empty", async () => {
      await userFactory
        .withCredentials({
          password: "Password123@",
        })
        .create({
          email: "test_3@example.com",
        });
      const response = await request(app.getHttpServer())
        .post("/api/auth/forgot-password")
        .send({ email: "" })
        .expect(400);

      expect(response.body.message).toEqual("Validation failed (body)");
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("should reset the password successfully", async () => {
      jest.spyOn(authService, "resetPassword").mockImplementation(async () => {});

      const response = await request(app.getHttpServer())
        .post("/api/auth/reset-password")
        .send({ resetToken: "valid-token", newPassword: "Newpassword123@" })
        .expect(201);

      expect(response.body.data).toEqual({
        message: "Password reset successfully",
      });
    });

    it("should return 400 if new password does not match criteria", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/reset-password")
        .send({ resetToken: "valid-token", newPassword: "passwordnotmatchcriteria" })
        .expect(400);

      expect(response.body.message).toEqual("Validation failed (body)");
    });

    it("should return 404 if reset token is missing", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/reset-password")
        .send({ resetToken: "", newPassword: "Newpassword123@" })
        .expect(400);

      expect(response.body.message).toEqual("Validation failed (body)");
    });

    it("should return 400 if password is too short", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/reset-password")
        .send({ resetToken: "valid-token", newPassword: "short" })
        .expect(400);

      expect(response.body.message).toEqual("Validation failed (body)");
    });
  });
});
