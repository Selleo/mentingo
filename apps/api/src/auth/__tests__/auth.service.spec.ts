import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { omit } from "lodash";
import { nanoid } from "nanoid";

import { AuthService } from "src/auth/auth.service";
import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { credentials, resetTokens, users } from "src/storage/schema";
import { createUnitTest, type TestContext } from "test/create-unit-test";
import { createSettingsFactory } from "test/factory/settings.factory";
import { createUserFactory } from "test/factory/user.factory";
import { truncateAllTables } from "test/helpers/test-helpers";

import type { DatabasePg } from "src/common";
import type { EmailTestingAdapter } from "test/helpers/test-email.adapter";

describe("AuthService", () => {
  let testContext: TestContext;
  let authService: AuthService;
  let jwtService: JwtService;
  let db: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let emailAdapter: EmailTestingAdapter;

  beforeAll(async () => {
    testContext = await createUnitTest();
    authService = testContext.module.get(AuthService);
    jwtService = testContext.module.get(JwtService);
    db = testContext.db;
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    emailAdapter = testContext.module.get(EmailAdapter);
  }, 30000);

  afterEach(async () => {
    await truncateAllTables(db);
    emailAdapter.clearEmails();
  });

  afterAll(async () => {
    await testContext.teardown();
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const user = userFactory.build();
      const password = "password123";

      const result = await authService.register({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password,
        language: "en",
      });

      const [savedUser] = await db.select().from(users).where(eq(users.email, user.email));

      const [savedCredentials] = await db
        .select()
        .from(credentials)
        .where(eq(credentials.userId, savedUser.id));

      expect(savedUser).toBeDefined();
      expect(result).toBeDefined();
      expect(result.email).toBe(user.email);
      expect(savedCredentials).toBeDefined();
      expect(await bcrypt.compare(password, savedCredentials.password)).toBe(true);
    });

    it("should send a welcome email after successful registration", async () => {
      const user = userFactory.build();
      const password = "password123";

      await settingsFactory.create({ userId: null });

      const allEmails = emailAdapter.getAllEmails();

      expect(allEmails).toHaveLength(0);

      await authService.register({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password,
        language: "en",
      });

      expect(allEmails).toHaveLength(1);
    });

    it("should throw ConflictException if user already exists", async () => {
      const email = "existing@example.com";
      const user = await userFactory.create({ email });

      await expect(
        authService.register({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          password: "password123",
          language: "en",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("login", () => {
    it("should login user successfully", async () => {
      const password = "password123";
      const email = "example@test.com";
      const user = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ email });

      const result = await authService.login(
        {
          email: user.email,
          password,
        },
        [],
      );

      const decodedToken = await jwtService.verifyAsync(result.accessToken);

      const { avatarReference: _, ...userWithoutAvatar } = user;

      expect(decodedToken.userId).toBe(user.id);
      expect(result).toMatchObject({
        ...omit(userWithoutAvatar, "credentials"),
        profilePictureUrl: null,
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        shouldVerifyMFA: false,
      });
    });

    it("should throw UnauthorizedException for invalid email", async () => {
      await expect(
        authService.login(
          {
            email: "nonexistent@example.com",
            password: "password123",
          },
          [],
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for invalid password", async () => {
      const user = await userFactory.create({ email: "example@test.com" });

      await expect(
        authService.login(
          {
            email: user.email,
            password: "wrongpassword",
          },
          [],
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("validateUser", () => {
    it("should validate user successfully", async () => {
      const email = "test@example.com";
      const password = "password123";

      await userFactory.withCredentials({ password }).create({ email });

      const result = await authService.validateUser(email, password);

      expect(result).toBeDefined();
      expect(result!.email).toBe(email);
    });

    it("should return null for invalid credentials", async () => {
      const email = "test@example.com";
      const password = "password123";

      const result = await authService.validateUser(email, password);

      expect(result).toBeNull();
    });
  });

  describe("currentUser", () => {
    it("should return current user data", async () => {
      await settingsFactory.create({ userId: null });
      const user = await userFactory.withUserSettings(db).create();

      const result = await authService.currentUser(user.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
    });

    it("should throw UnauthorizedException for non-existent user", async () => {
      const nonExistentUserId = crypto.randomUUID();

      await expect(authService.currentUser(nonExistentUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe("forgotPassword", () => {
    it("should generate a reset token and send an email", async () => {
      const email = "user@example.com";
      const password = "password123";

      await userFactory.withCredentials({ password }).create({ email });
      await settingsFactory.create({ userId: null });

      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1);

      const allEmails = emailAdapter.getAllEmails();
      expect(allEmails).toHaveLength(0);

      await authService.forgotPassword(email);

      expect(allEmails).toHaveLength(1);
      expect(allEmails[0]).toBeDefined();
      expect(allEmails[0].to).toBe(email);
      expect(allEmails[0].subject).toBe("Password recovery");
    });

    it("should throw BadRequestException if email is not found", async () => {
      const email = "nonexistent@example.com";

      await expect(authService.forgotPassword(email)).rejects.toThrow(NotFoundException);
    });
  });

  describe("resetPassword", () => {
    it("should reset the password and delete the token", async () => {
      const newPassword = "NewPassword123";
      const resetToken = nanoid(64);

      const password = "password123";
      const email = "example@test.com";
      const user = await userFactory.withCredentials({ password }).create({ email });

      await db.insert(resetTokens).values({
        userId: user.id,
        resetToken,
        expiryDate: new Date(Date.now() + 3600000),
      });

      await authService.resetPassword(resetToken, newPassword);
      const [savedCredentials] = await db
        .select()
        .from(credentials)
        .where(eq(credentials.userId, user.id));

      expect(user).toBeDefined();
      expect(await bcrypt.compare(newPassword, savedCredentials.password)).toBe(true);

      const [deletedToken] = await db
        .select()
        .from(resetTokens)
        .where(eq(resetTokens.resetToken, resetToken));

      expect(deletedToken).toBeUndefined();
    });
  });
});
