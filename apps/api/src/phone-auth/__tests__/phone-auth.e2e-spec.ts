import { eq, sql } from "drizzle-orm";
import request from "supertest";

import { PHONE_AUTH_ERRORS, SMS_PROVIDER } from "src/phone-auth/phone-auth.constants";
import { REDIS_CLIENT } from "src/redis/redis.tokens";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { settings, users } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { SmsMessage, SmsProvider } from "src/phone-auth/phone-auth.types";
import type { RedisClient } from "src/redis";

class RecordingSmsProvider implements SmsProvider {
  readonly name = "recording";
  messages: SmsMessage[] = [];

  async send(message: SmsMessage) {
    this.messages.push(message);
    return {};
  }

  clear() {
    this.messages = [];
  }
}

const extractCode = (message?: SmsMessage) => message?.text.match(/\b(\d{6})\b/)?.[1] ?? "";

describe("PhoneAuth (e2e)", () => {
  const originalEnabled = process.env.PHONE_AUTH_ENABLED;
  const smsProvider = new RecordingSmsProvider();

  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let redis: RedisClient;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let ipCounter = 0;

  // Every test uses its own client IP so the per-IP throttler does not leak between tests.
  const nextIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;

  const waitForSms = async (expectedCount: number) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (smsProvider.messages.length >= expectedCount) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    return smsProvider.messages;
  };

  const createStudentWithPhone = async (phone: string | null, overrides = {}) =>
    userFactory
      .withCredentials({ password: "Password123@" })
      .withUserSettings(db)
      .create({ phone, ...overrides });

  const requestLoginCode = (phone: string, ip = nextIp()) =>
    request(app.getHttpServer())
      .post("/api/auth/phone/request-code")
      .set("X-Forwarded-For", ip)
      .send({ phone });

  const verifyLoginCode = (phone: string, code: string, ip = nextIp()) =>
    request(app.getHttpServer())
      .post("/api/auth/phone/verify")
      .set("X-Forwarded-For", ip)
      .send({ phone, code });

  beforeAll(async () => {
    process.env.PHONE_AUTH_ENABLED = "true";

    const { app: testApp } = await createE2ETest([
      { provide: SMS_PROVIDER, useValue: smsProvider },
    ]);

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    redis = app.get(REDIS_CLIENT);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  beforeEach(async () => {
    process.env.PHONE_AUTH_ENABLED = "true";
    smsProvider.clear();

    const keys = [...(await redis.keys("phone-otp:*")), ...(await redis.keys("rate-limit:*"))];

    if (keys.length) await redis.del(keys);

    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateTables(baseDb, ["users", "settings"]);
  });

  afterAll(async () => {
    if (originalEnabled === undefined) delete process.env.PHONE_AUTH_ENABLED;
    else process.env.PHONE_AUTH_ENABLED = originalEnabled;

    await app.close();
  });

  describe("GET /api/auth/phone/config", () => {
    it("reports whether the feature is enabled", async () => {
      const enabled = await request(app.getHttpServer()).get("/api/auth/phone/config").expect(200);

      expect(enabled.body.data).toEqual({ enabled: true });

      process.env.PHONE_AUTH_ENABLED = "false";

      const disabled = await request(app.getHttpServer()).get("/api/auth/phone/config").expect(200);

      expect(disabled.body.data).toEqual({ enabled: false });
    });
  });

  describe("POST /api/auth/phone/request-code", () => {
    it("sends a Russian SMS to a registered number and never exposes the code", async () => {
      await createStudentWithPhone("+79161234567");

      const response = await requestLoginCode("8 (916) 123-45-67").expect(201);

      expect(response.body.data).toEqual({
        message: "phoneAuth.toast.codeSent",
        resendAvailableInSeconds: 60,
        codeTtlSeconds: 300,
      });

      const [message] = await waitForSms(1);

      expect(message.to).toBe("+79161234567");
      expect(message.text).toMatch(/^Код входа в LMS: \d{6}\. Никому не сообщайте его\.$/);
      expect(JSON.stringify(response.body)).not.toContain(extractCode(message));
    });

    it("returns the same response for unknown numbers without sending an SMS", async () => {
      const response = await requestLoginCode("+79160000000").expect(201);

      expect(response.body.data).toEqual({
        message: "phoneAuth.toast.codeSent",
        resendAvailableInSeconds: 60,
        codeTtlSeconds: 300,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(smsProvider.messages).toHaveLength(0);
    });

    it("does not send codes to archived users", async () => {
      await createStudentWithPhone("+79161234567", { archived: true });

      await requestLoginCode("+79161234567").expect(201);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(smsProvider.messages).toHaveLength(0);
    });

    it("rejects invalid numbers", async () => {
      const response = await requestLoginCode("12345").expect(400);

      expect(response.body.message).toBe(PHONE_AUTH_ERRORS.INVALID_PHONE);
    });

    it("applies the resend cooldown to known and unknown numbers alike", async () => {
      await createStudentWithPhone("+79161234567");

      await requestLoginCode("+79161234567").expect(201);
      const known = await requestLoginCode("+79161234567").expect(429);

      await requestLoginCode("+79160000000").expect(201);
      const unknown = await requestLoginCode("+79160000000").expect(429);

      expect(known.body.message).toBe(PHONE_AUTH_ERRORS.RESEND_COOLDOWN);
      expect(unknown.body.message).toBe(PHONE_AUTH_ERRORS.RESEND_COOLDOWN);
    });

    it("limits requests per IP", async () => {
      const ip = nextIp();

      for (let index = 0; index < 10; index += 1) {
        await requestLoginCode(`+7916000000${index}`, ip).expect(201);
      }

      const response = await requestLoginCode("+79160000010", ip).expect(429);

      expect(response.body.message).toBe("common.toast.tooManyRequests");
    });

    it("returns 403 when the feature is disabled", async () => {
      process.env.PHONE_AUTH_ENABLED = "false";

      const response = await requestLoginCode("+79161234567").expect(403);

      expect(response.body.message).toBe(PHONE_AUTH_ERRORS.DISABLED);
    });
  });

  describe("POST /api/auth/phone/verify", () => {
    it("logs the user in with session cookies and marks the phone verified", async () => {
      const user = await createStudentWithPhone("+79161234567");

      await requestLoginCode("+79161234567").expect(201);
      const [message] = await waitForSms(1);

      const response = await verifyLoginCode("89161234567", extractCode(message)).expect(201);

      expect(response.body.data).toMatchObject({
        id: user.id,
        email: user.email,
        shouldVerifyMFA: false,
      });
      expect(response.body.data.phone).toBe("+79161234567");
      expect(response.headers["set-cookie"]).toHaveLength(2);

      const [stored] = await db
        .select({ phoneVerifiedAt: users.phoneVerifiedAt })
        .from(users)
        .where(eq(users.id, user.id));

      expect(stored.phoneVerifiedAt).not.toBeNull();
      expect(response.body.data.phoneVerifiedAt).toEqual(expect.any(String));
    });

    it("rejects a reused code", async () => {
      await createStudentWithPhone("+79161234567");

      await requestLoginCode("+79161234567").expect(201);
      const code = extractCode((await waitForSms(1))[0]);

      await verifyLoginCode("+79161234567", code).expect(201);

      const response = await verifyLoginCode("+79161234567", code).expect(401);

      expect(response.body.message).toBe(PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE);
    });

    it("rejects wrong codes and burns the code after 5 attempts", async () => {
      await createStudentWithPhone("+79161234567");

      await requestLoginCode("+79161234567").expect(201);
      const code = extractCode((await waitForSms(1))[0]);
      const wrongCode = code === "000000" ? "111111" : "000000";

      for (let attempt = 1; attempt < 5; attempt += 1) {
        const response = await verifyLoginCode("+79161234567", wrongCode).expect(401);
        expect(response.body.message).toBe(PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE);
      }

      const lastAttempt = await verifyLoginCode("+79161234567", wrongCode).expect(400);
      expect(lastAttempt.body.message).toBe(PHONE_AUTH_ERRORS.TOO_MANY_ATTEMPTS);

      await verifyLoginCode("+79161234567", code).expect(401);
    });

    it("rejects malformed codes", async () => {
      await verifyLoginCode("+79161234567", "12ab").expect(400);
    });

    it("goes through the MFA step when MFA is enabled for the user", async () => {
      const user = await createStudentWithPhone("+79161234567");

      await db
        .update(settings)
        .set({ settings: sql`${settings.settings} || '{"isMFAEnabled": true}'::jsonb` })
        .where(eq(settings.userId, user.id));

      await requestLoginCode("+79161234567").expect(201);
      const code = extractCode((await waitForSms(1))[0]);

      const response = await verifyLoginCode("+79161234567", code).expect(201);

      expect(response.body.data).toMatchObject({ id: user.id, shouldVerifyMFA: true });
      // Temporary (5 minute) cookies, exactly like password login with MFA.
      expect(response.headers["set-cookie"]).toHaveLength(2);
      expect((response.headers["set-cookie"] as unknown as string[]).join(";")).toContain(
        "Max-Age=300",
      );
    });

    it("does not log in a user whose phone was removed after the code was sent", async () => {
      const user = await createStudentWithPhone("+79161234567");

      await requestLoginCode("+79161234567").expect(201);
      const code = extractCode((await waitForSms(1))[0]);

      await db.update(users).set({ phone: null }).where(eq(users.id, user.id));

      await verifyLoginCode("+79161234567", code).expect(401);
    });
  });

  describe("attaching a phone to the current user", () => {
    it("verifies the new number with an SMS code and stores it as verified", async () => {
      const user = await createStudentWithPhone(null);
      const cookies = await cookieFor(user, app);

      await request(app.getHttpServer())
        .post("/api/user/phone/request-code")
        .set("Cookie", cookies)
        .send({ phone: "+976 8811 2233" })
        .expect(201);

      const [message] = await waitForSms(1);

      expect(message.to).toBe("+97688112233");
      expect(message.text).toContain("Код подтверждения телефона в LMS");

      await request(app.getHttpServer())
        .post("/api/user/phone/verify")
        .set("Cookie", cookies)
        .send({
          phone: "+97688112233",
          code: "000000" === extractCode(message) ? "111111" : "000000",
        })
        .expect(401);

      const response = await request(app.getHttpServer())
        .post("/api/user/phone/verify")
        .set("Cookie", cookies)
        .send({ phone: "97688112233", code: extractCode(message) })
        .expect(201);

      expect(response.body.data.phone).toBe("+97688112233");
      expect(response.body.data.phoneVerifiedAt).toEqual(expect.any(String));
    });

    it("rejects a number that belongs to another user of the tenant", async () => {
      await createStudentWithPhone("+79161234567");
      const user = await createStudentWithPhone(null);
      const cookies = await cookieFor(user, app);

      const response = await request(app.getHttpServer())
        .post("/api/user/phone/request-code")
        .set("Cookie", cookies)
        .send({ phone: "+79161234567" })
        .expect(409);

      expect(response.body.message).toBe(PHONE_AUTH_ERRORS.PHONE_TAKEN);
      expect(smsProvider.messages).toHaveLength(0);
    });

    it("does not accept a code issued for another user", async () => {
      const owner = await createStudentWithPhone(null);
      const attacker = await createStudentWithPhone(null);
      const ownerCookies = await cookieFor(owner, app);
      const attackerCookies = await cookieFor(attacker, app);

      await request(app.getHttpServer())
        .post("/api/user/phone/request-code")
        .set("Cookie", ownerCookies)
        .send({ phone: "+79161234567" })
        .expect(201);

      const code = extractCode((await waitForSms(1))[0]);

      await request(app.getHttpServer())
        .post("/api/user/phone/verify")
        .set("Cookie", attackerCookies)
        .send({ phone: "+79161234567", code })
        .expect(401);
    });

    it("does not let users set their own phone without verification", async () => {
      const user = await createStudentWithPhone(null);
      const cookies = await cookieFor(user, app);

      await request(app.getHttpServer())
        .patch(`/api/user?id=${user.id}`)
        .set("Cookie", cookies)
        .send({ phone: "+79161234567" })
        .expect(403);
    });

    it("removes the phone", async () => {
      const user = await createStudentWithPhone("+79161234567");
      const cookies = await cookieFor(user, app);

      const response = await request(app.getHttpServer())
        .delete("/api/user/phone")
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data).toEqual({ phone: null, phoneVerifiedAt: null });
    });
  });

  describe("admin phone management", () => {
    it("normalizes, stores unverified and enforces per-tenant uniqueness", async () => {
      const admin = await userFactory
        .withCredentials({ password: "Password123@" })
        .withAdminSettings(db)
        .withAdminRole()
        .create();
      const adminCookies = await cookieFor(admin, app);
      const student = await createStudentWithPhone(null);
      await createStudentWithPhone("+79031112233");

      await request(app.getHttpServer())
        .patch(`/api/user/admin?id=${student.id}`)
        .set("Cookie", adminCookies)
        .send({ phone: "8 916 123-45-67" })
        .expect(200);

      const details = await request(app.getHttpServer())
        .get(`/api/user?id=${student.id}`)
        .set("Cookie", adminCookies)
        .expect(200);

      expect(details.body.data).toMatchObject({ phone: "+79161234567", phoneVerifiedAt: null });

      const taken = await request(app.getHttpServer())
        .patch(`/api/user/admin?id=${student.id}`)
        .set("Cookie", adminCookies)
        .send({ phone: "+79031112233" })
        .expect(409);

      expect(taken.body.message).toBe(PHONE_AUTH_ERRORS.PHONE_TAKEN);

      await request(app.getHttpServer())
        .patch(`/api/user/admin?id=${student.id}`)
        .set("Cookie", adminCookies)
        .send({ phone: "not-a-phone" })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/user/admin?id=${student.id}`)
        .set("Cookie", adminCookies)
        .send({ phone: "" })
        .expect(200);

      const [cleared] = await db
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, student.id));

      expect(cleared.phone).toBeNull();
    });
  });
});
