import { SYSTEM_ROLE_SLUGS, PERMISSIONS } from "@repo/shared";
import * as cookie from "cookie";
import { eq } from "drizzle-orm";
import { isArray, omit } from "lodash";
import { nanoid } from "nanoid";
import request from "supertest";

import { hashToken } from "src/auth/utils/hash-auth-token";
import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { RATE_LIMITS } from "src/rate-limit/rate-limit.constants";
import { SettingsService } from "src/settings/settings.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { createTokens, formFieldAnswers, magicLinkTokens, resetTokens } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { AuthService } from "../auth.service";

import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("AuthController (e2e)", () => {
  let app: INestApplication;
  let authService: AuthService;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let settingsService: SettingsService;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    authService = app.get(AuthService);
    settingsService = app.get(SettingsService);
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    (app.get(EmailAdapter) as EmailTestingAdapter).clearEmails();
    await truncateTables(baseDb, [
      "create_tokens",
      "form_field_answers",
      "form_fields",
      "forms",
      "magic_link_tokens",
      "reset_tokens",
      "settings",
    ]);
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
          language: "en",
        });

      expect(response.status).toEqual(201);
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data.email).toBe(user.email);
      expect(response.body.data).toHaveProperty("shouldVerifyMFA");
      expect(response.body.data).toHaveProperty("onboardingStatus");
      expect(response.body.data).toHaveProperty("isManagingTenantAdmin");
      expect(response.headers["set-cookie"]).toBeDefined();
      expect(response.headers["set-cookie"].length).toBe(2);
    });

    it("should return 409 if user already exists", async () => {
      const existingUser = {
        email: "existing@example.com",
        password: "Password123@",
        firstName: "Tyler",
        lastName: "Durden",
        language: "en",
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

    it("should fallback to 'en' when registering with unsupported language (e.g., 'ar')", async () => {
      const user = userFactory.build();
      const password = "Password123@";

      const registeredUser = await authService.register({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password,
        language: "ar",
      });

      const userSettings = await settingsService.getUserSettings(registeredUser.id);

      expect(userSettings).toBeDefined();
      expect(userSettings.language).toBe("en");
    });

    it("should save correct language when registering with supported language other than 'en'", async () => {
      const user = userFactory.build();
      const password = "Password123@";

      const registeredUser = await authService.register({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password,
        language: "pl",
      });

      const userSettings = await settingsService.getUserSettings(registeredUser.id);

      expect(userSettings).toBeDefined();
      expect(userSettings.language).toBe("pl");
    });

    it("should save registration checkbox answers with the label snapshot", async () => {
      const registrationForm = await settingsService.updateRegistrationForm({
        fields: [
          {
            type: "checkbox",
            required: true,
            displayOrder: 0,
            archived: false,
            label: {
              en: '<p>I accept the <a href="https://example.com/terms">Terms</a>.</p>',
              pl: '<p>Akceptuje <a href="https://example.com/terms">Regulamin</a>.</p>',
            },
          },
        ],
      });

      const field = registrationForm.fields[0];
      const user = userFactory.build();

      const response = await request(app.getHttpServer())
        .post("/api/auth/register")
        .send({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          password: "Password123@",
          language: "pl",
          formAnswers: {
            [field.id]: true,
          },
        })
        .expect(201);

      const [answer] = await db
        .select()
        .from(formFieldAnswers)
        .where(eq(formFieldAnswers.userId, response.body.data.id));

      expect(answer).toBeDefined();
      expect(answer.value).toBe(true);
      expect(answer.answeredLanguage).toBe("pl");
      expect(answer.labelSnapshot).toEqual(field.label);
    });

    it("should reject registration when a required checkbox answer is missing", async () => {
      await settingsService.updateRegistrationForm({
        fields: [
          {
            type: "checkbox",
            required: true,
            displayOrder: 0,
            archived: false,
            label: {
              en: "<p>I accept the terms.</p>",
              pl: "<p>Akceptuje regulamin.</p>",
            },
          },
        ],
      });

      const user = userFactory.build();

      await request(app.getHttpServer())
        .post("/api/auth/register")
        .send({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          password: "Password123@",
          language: "en",
        })
        .expect(400);
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

    it("should return 429 after reaching auth login limit for the same email", async () => {
      const email = `rate-limit-auth-${nanoid()}@example.com`;

      for (
        let attempt = 1;
        attempt <= RATE_LIMITS.AUTH_SENSITIVE_ENDPOINTS_REQUESTS_PER_MINUTE;
        attempt += 1
      ) {
        await request(app.getHttpServer())
          .post("/api/auth/login")
          .send({
            email,
            password: "wrongpassword",
          })
          .expect(401);
      }

      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email,
          password: "wrongpassword",
        })
        .expect(429);
    });

    it("should not apply login rate limit from one email to another email", async () => {
      const rateLimitedEmail = `rate-limit-auth-a-${nanoid()}@example.com`;

      for (
        let attempt = 1;
        attempt <= RATE_LIMITS.AUTH_SENSITIVE_ENDPOINTS_REQUESTS_PER_MINUTE;
        attempt += 1
      ) {
        await request(app.getHttpServer())
          .post("/api/auth/login")
          .send({
            email: rateLimitedEmail,
            password: "wrongpassword",
          })
          .expect(401);
      }

      const allowedUser = await userFactory
        .withCredentials({
          password: "Password123@",
        })
        .withUserSettings(db)
        .create({
          email: `rate-limit-auth-b-${nanoid()}@example.com`,
        });

      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: allowedUser.email,
          password: "Password123@",
        })
        .expect(201);
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
        language: "en",
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
        language: "en",
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

      expect(currentUser).toMatchObject({
        ...omit(user, "credentials", "avatarReference"),
        profilePictureUrl: null,
        groups: [],
        isManagingTenantAdmin: false,
        isSupportMode: false,
        studentModeCourseIds: [],
        shouldVerifyMFA: false,
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
      });
      expect(currentUser.permissions).toEqual(
        expect.arrayContaining([
          PERMISSIONS.COURSE_READ,
          PERMISSIONS.COURSE_READ_ASSIGNED,
          PERMISSIONS.LEARNING_PROGRESS_UPDATE,
        ]),
      );
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
        .withUserSettings(db)
        .create({
          email: "test_2@example.com",
        });

      settingsFactory.create({ userId: user.id });

      const response = await request(app.getHttpServer())
        .post("/api/auth/forgot-password")
        .send({ email: user.email })
        .expect(201);

      expect(response.body.data).toEqual({
        message: "forgotPasswordView.toast.resetPassword",
      });
    });

    it("should return success for archived users without sending a reset email", async () => {
      const user = await userFactory.create({
        email: "archived-forgot-password@example.com",
        archived: true,
      });

      const response = await request(app.getHttpServer())
        .post("/api/auth/forgot-password")
        .send({ email: user.email })
        .expect(201);

      expect(response.body.data).toEqual({
        message: "forgotPasswordView.toast.resetPassword",
      });
      expect((app.get(EmailAdapter) as EmailTestingAdapter).getAllEmails()).toHaveLength(0);
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
    it("should return 404 when reset token is invalid", async () => {
      const user = await userFactory
        .withCredentials({ password: "Password123@" })
        .withUserSettings(db)
        .create();
      const expiryDate = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(resetTokens).values({
        userId: user.id,
        tokenHash: hashToken(nanoid(64)),
        expiryDate,
      });

      await request(app.getHttpServer())
        .post("/api/auth/reset-password")
        .send({
          resetToken: nanoid(64),
          newPassword: "Newpassword123@",
        })
        .expect(404);
    });

    it("should return 404 when reset token is expired", async () => {
      const user = await userFactory
        .withCredentials({ password: "Password123@" })
        .withUserSettings(db)
        .create();
      const resetToken = nanoid(64);
      const expiryDate = new Date(Date.now() - 60 * 60 * 1000);

      await db.insert(resetTokens).values({
        userId: user.id,
        tokenHash: hashToken(resetToken),
        expiryDate,
      });

      await request(app.getHttpServer())
        .post("/api/auth/reset-password")
        .send({
          resetToken: nanoid(64),
          newPassword: "Newpassword123@",
        })
        .expect(404);
    });

    it("should reset password and delete token when reset token is stored as hash", async () => {
      const user = await userFactory
        .withCredentials({ password: "Password123@" })
        .withUserSettings(db)
        .create();
      const resetToken = nanoid(64);
      const expiryDate = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(resetTokens).values({
        userId: user.id,
        tokenHash: hashToken(resetToken),
        expiryDate,
      });

      await request(app.getHttpServer())
        .post("/api/auth/reset-password")
        .send({
          resetToken,
          newPassword: "Newpassword123@",
        })
        .expect(201);

      const [remainingToken] = await db
        .select()
        .from(resetTokens)
        .where(eq(resetTokens.userId, user.id));

      expect(remainingToken).toBeUndefined();

      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: "Newpassword123@",
        })
        .expect(201);
    });

    it("should return 400 if new password does not match criteria", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/reset-password")
        .send({
          resetToken: "valid-token",
          newPassword: "passwordnotmatchcriteria",
        })
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

  describe("POST /api/auth/create-password", () => {
    it("should return 404 when create token is invalid", async () => {
      const user = await userFactory.create({
        email: `createpassword-main-${nanoid(8)}@example.com`,
      });

      const expiryDate = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(createTokens).values({
        userId: user.id,
        tokenHash: hashToken(nanoid(64)),
        expiryDate,
        reminderCount: 0,
      });

      await request(app.getHttpServer())
        .post("/api/auth/create-password")
        .send({
          createToken: nanoid(64),
          password: "Password123@",
          language: "en",
        })
        .expect(404);
    });

    it("should return 404 when create token is expired", async () => {
      const user = await userFactory.create({
        email: `createpassword-expired-${nanoid(8)}@example.com`,
      });
      const token = nanoid(64);
      const expiryDate = new Date(Date.now() - 60 * 60 * 1000);

      await db.insert(createTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiryDate,
        reminderCount: 0,
      });

      await request(app.getHttpServer())
        .post("/api/auth/create-password")
        .send({
          createToken: token,
          password: "Password123@",
          language: "en",
        })
        .expect(404);
    });

    it("should return 400 when create token is missing", async () => {
      await request(app.getHttpServer())
        .post("/api/auth/create-password")
        .send({
          createToken: "",
          password: "Password123@",
          language: "en",
        })
        .expect(400);
    });

    it("should create password and login user with cookies", async () => {
      const user = await userFactory.create({
        email: `createpassword-login-${nanoid(8)}@example.com`,
      });

      const token = nanoid(64);
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      await db.insert(createTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiryDate,
        reminderCount: 0,
      });

      const response = await request(app.getHttpServer())
        .post("/api/auth/create-password")
        .send({
          createToken: token,
          password: "Password123@",
          language: "en",
        })
        .expect(201);

      expect(response.body.data).toHaveProperty("id", user.id);
      expect(response.body.data).toHaveProperty("email", user.email);
      expect(response.body.data).toHaveProperty("shouldVerifyMFA");
      expect(response.body.data).toHaveProperty("onboardingStatus");
      expect(response.body.data).toHaveProperty("isManagingTenantAdmin");
      expect(response.headers["set-cookie"]).toBeDefined();
      expect(response.headers["set-cookie"].length).toBe(2);

      const [remainingToken] = await db
        .select()
        .from(createTokens)
        .where(eq(createTokens.userId, user.id));

      expect(remainingToken).toBeUndefined();
    });

    it("should save correct language when creating password with supported language other than 'en'", async () => {
      const user = await userFactory.create({
        email: "createpassword@example.com",
      });

      const token = nanoid(64);
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      await db.insert(createTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiryDate,
        reminderCount: 0,
      });

      const password = "Password123@";

      await authService.createPassword({
        createToken: token,
        password,
        language: "pl",
      });

      const loginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
        email: user.email,
        password: password,
      });

      expect(loginResponse.status).toBe(201);

      const cookies = loginResponse.headers["set-cookie"];
      let accessToken = "";

      if (Array.isArray(cookies)) {
        cookies.forEach((cookieString) => {
          const parsedCookie = cookie.parse(cookieString);
          if ("access_token" in parsedCookie) {
            accessToken = parsedCookie.access_token;
          }
        });
      }

      const settingsResponse = await request(app.getHttpServer())
        .get("/api/settings")
        .set("Cookie", `access_token=${accessToken};`)
        .expect(200);

      expect(settingsResponse.body.data).toBeDefined();
      expect(settingsResponse.body.data.language).toBe("pl");
    });

    it("should return 400 when creating password with unsupported language (e.g., 'ar')", async () => {
      const user = await userFactory.create({
        email: `createpassword-${nanoid(8)}@example.com`,
      });

      const token = nanoid(64);
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      await db.insert(createTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiryDate,
        reminderCount: 0,
      });

      const response = await request(app.getHttpServer())
        .post("/api/auth/create-password")
        .send({
          createToken: token,
          password: "Password123@",
          language: "ar",
        })
        .expect(400);

      expect(response.body.message).toEqual("Validation failed (body)");
    });

    it("should create password when create token is stored as hash", async () => {
      const user = await userFactory.create({
        email: `createpassword-hashed-${nanoid(8)}@example.com`,
      });

      const token = nanoid(64);
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      await db.insert(createTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiryDate,
        reminderCount: 0,
      });

      await authService.createPassword({
        createToken: token,
        password: "Password123@",
        language: "en",
      });

      const [remainingToken] = await db
        .select()
        .from(createTokens)
        .where(eq(createTokens.userId, user.id));

      expect(remainingToken).toBeUndefined();

      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: "Password123@",
        })
        .expect(201);
    });
  });

  describe("POST /api/auth/magic-link/create", () => {
    it("should create a magic link token as a hash and send the token in email", async () => {
      const user = await userFactory
        .withCredentials({ password: "Password123@" })
        .withUserSettings(db)
        .create({
          email: `magiclink-create-${nanoid(8)}@example.com`,
        });

      await request(app.getHttpServer())
        .post("/api/auth/magic-link/create")
        .send({ email: user.email })
        .expect(201);

      const emailAdapter = app.get(EmailAdapter) as EmailTestingAdapter;
      const email = emailAdapter.getLastEmail();

      expect(email).toBeDefined();
      expect(email?.to).toBe(user.email);
      expect(email?.subject).toBeDefined();
      expect(email?.html || email?.text).toContain("/auth/login?token=");

      const tokenMatch = (email?.html ?? email?.text ?? "").match(
        /\/auth\/login\?token=([^"&\s]+)/,
      );
      expect(tokenMatch).not.toBeNull();

      const token = tokenMatch?.[1];
      expect(token).toBeDefined();

      const [storedToken] = await db
        .select()
        .from(magicLinkTokens)
        .where(eq(magicLinkTokens.userId, user.id));

      expect(storedToken).toBeDefined();
      expect(storedToken?.tokenHash).toBe(hashToken(token!));
      expect(storedToken?.expiryDate).toBeDefined();
    });

    it("should return success for archived users without sending a magic link", async () => {
      const user = await userFactory.create({
        email: `magiclink-archived-${nanoid(8)}@example.com`,
        archived: true,
      });

      const response = await request(app.getHttpServer())
        .post("/api/auth/magic-link/create")
        .send({ email: user.email })
        .expect(201);

      expect(response.body.data).toEqual({
        message: "magicLink.createdSuccessfully",
      });
      expect((app.get(EmailAdapter) as EmailTestingAdapter).getAllEmails()).toHaveLength(0);

      const [storedToken] = await db
        .select()
        .from(magicLinkTokens)
        .where(eq(magicLinkTokens.userId, user.id));

      expect(storedToken).toBeUndefined();
    });

    it("should return success when magic link token creation fails", async () => {
      const user = await userFactory
        .withCredentials({ password: "Password123@" })
        .withUserSettings(db)
        .create({
          email: `magiclink-token-failure-${nanoid(8)}@example.com`,
        });

      jest.spyOn(authService, "createMagicLinkToken").mockRejectedValueOnce(new Error("boom"));

      const response = await request(app.getHttpServer())
        .post("/api/auth/magic-link/create")
        .send({ email: user.email })
        .expect(201);

      expect(response.body.data).toEqual({
        message: "magicLink.createdSuccessfully",
      });
      expect((app.get(EmailAdapter) as EmailTestingAdapter).getAllEmails()).toHaveLength(0);

      const [storedToken] = await db
        .select()
        .from(magicLinkTokens)
        .where(eq(magicLinkTokens.userId, user.id));

      expect(storedToken).toBeUndefined();
    });
  });

  describe("GET /api/auth/magic-link/verify", () => {
    it("should log in with a valid magic link and remove the consumed token", async () => {
      const user = await userFactory
        .withCredentials({ password: "Password123@" })
        .withUserSettings(db)
        .create({
          email: `magiclink-verify-${nanoid(8)}@example.com`,
        });

      const token = await authService.createMagicLinkToken(user.id);

      const response = await request(app.getHttpServer())
        .get("/api/auth/magic-link/verify")
        .query({ token })
        .expect(200);

      expect(response.body.data).toHaveProperty("id", user.id);
      expect(response.body.data).toHaveProperty("email", user.email);
      expect(response.body.data).toHaveProperty("shouldVerifyMFA", false);
      expect(response.headers["set-cookie"]).toBeDefined();
      expect(response.headers["set-cookie"].length).toBe(2);

      const [remainingToken] = await db
        .select()
        .from(magicLinkTokens)
        .where(eq(magicLinkTokens.userId, user.id));

      expect(remainingToken).toBeUndefined();
    });

    it("should reject an invalid magic link token", async () => {
      await request(app.getHttpServer())
        .get("/api/auth/magic-link/verify")
        .query({ token: "invalid-token" })
        .expect(401);
    });
  });
});
