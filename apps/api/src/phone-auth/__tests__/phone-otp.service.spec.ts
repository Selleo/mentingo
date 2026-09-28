import { HttpException, HttpStatus } from "@nestjs/common";

import {
  PHONE_AUTH_ERRORS,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_MAX_CODES_PER_WINDOW,
  PHONE_OTP_PURPOSE,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_OTP_TTL_SECONDS,
} from "src/phone-auth/phone-auth.constants";
import { PhoneOtpService } from "src/phone-auth/phone-otp.service";

import { FakeRedis } from "./fake-redis";

import type { PhoneOtpContext } from "src/phone-auth/phone-auth.types";
import type { RedisClient } from "src/redis";

const expectHttpError = async (promise: Promise<unknown>, status: number, message: string) => {
  const error = await promise.then(
    () => {
      throw new Error("Expected promise to reject");
    },
    (rejection: unknown) => rejection,
  );

  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(status);

  const response = (error as HttpException).getResponse();
  const responseMessage =
    typeof response === "string" ? response : (response as { message: string }).message;

  expect(responseMessage).toBe(message);

  return error as HttpException;
};

describe("PhoneOtpService", () => {
  const originalSecret = process.env.PHONE_OTP_SECRET;

  const context: PhoneOtpContext = {
    tenantId: "11111111-1111-1111-1111-111111111111",
    purpose: PHONE_OTP_PURPOSE.LOGIN,
    phone: "+79161234567",
  };

  let redis: FakeRedis;
  let service: PhoneOtpService;

  beforeEach(() => {
    process.env.PHONE_OTP_SECRET = "unit-test-otp-secret";
    jest.useFakeTimers({ now: new Date("2026-01-01T10:00:00Z") });
    redis = new FakeRedis();
    service = new PhoneOtpService(redis as unknown as RedisClient);
  });

  afterEach(() => {
    jest.useRealTimers();

    if (originalSecret === undefined) delete process.env.PHONE_OTP_SECRET;
    else process.env.PHONE_OTP_SECRET = originalSecret;
  });

  describe("issue", () => {
    it("returns a 6-digit code and stores only its HMAC", async () => {
      const code = await service.issue(context);

      expect(code).toMatch(/^\d{6}$/);

      const serializedStore = JSON.stringify(redis.rawValues());

      expect(serializedStore).not.toContain(code);
      expect(serializedStore).toContain(service.hashCode(context, code));
    });

    it("binds the hash to tenant, purpose, subject and phone", () => {
      const base = service.hashCode(context, "123456");

      expect(service.hashCode({ ...context, tenantId: "other" }, "123456")).not.toBe(base);
      expect(
        service.hashCode({ ...context, purpose: PHONE_OTP_PURPOSE.ATTACH }, "123456"),
      ).not.toBe(base);
      expect(service.hashCode({ ...context, subjectId: "user" }, "123456")).not.toBe(base);
      expect(service.hashCode({ ...context, phone: "+79160000000" }, "123456")).not.toBe(base);
    });

    it("replaces the previous code for the same context", async () => {
      const firstCode = await service.issue(context);
      const secondCode = await service.issue(context);

      if (firstCode !== secondCode) {
        await expectHttpError(
          service.verify(context, firstCode),
          HttpStatus.UNAUTHORIZED,
          PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE,
        );
      }

      await expect(service.verify(context, secondCode)).resolves.toBeUndefined();
    });
  });

  describe("verify", () => {
    it("accepts the correct code once and deletes it", async () => {
      const code = await service.issue(context);

      await expect(service.verify(context, code)).resolves.toBeUndefined();

      await expectHttpError(
        service.verify(context, code),
        HttpStatus.UNAUTHORIZED,
        PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE,
      );
    });

    it("rejects a code issued for another context", async () => {
      const code = await service.issue(context);

      await expectHttpError(
        service.verify({ ...context, tenantId: "22222222-2222-2222-2222-222222222222" }, code),
        HttpStatus.UNAUTHORIZED,
        PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE,
      );
    });

    it("expires codes after the TTL", async () => {
      const code = await service.issue(context);

      jest.advanceTimersByTime((PHONE_OTP_TTL_SECONDS - 1) * 1000);
      expect(redis.keys().length).toBe(1);

      jest.advanceTimersByTime(2 * 1000);

      await expectHttpError(
        service.verify(context, code),
        HttpStatus.UNAUTHORIZED,
        PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE,
      );
    });

    it(`allows at most ${PHONE_OTP_MAX_ATTEMPTS} attempts and then burns the code`, async () => {
      const code = await service.issue(context);
      const wrongCode = code === "000000" ? "111111" : "000000";

      for (let attempt = 1; attempt < PHONE_OTP_MAX_ATTEMPTS; attempt++) {
        await expectHttpError(
          service.verify(context, wrongCode),
          HttpStatus.UNAUTHORIZED,
          PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE,
        );
      }

      await expectHttpError(
        service.verify(context, wrongCode),
        HttpStatus.BAD_REQUEST,
        PHONE_AUTH_ERRORS.TOO_MANY_ATTEMPTS,
      );

      // The correct code no longer works after the attempt budget is exhausted.
      await expectHttpError(
        service.verify(context, code),
        HttpStatus.UNAUTHORIZED,
        PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE,
      );
    });

    it("still accepts the correct code on the last allowed attempt", async () => {
      const code = await service.issue(context);
      const wrongCode = code === "000000" ? "111111" : "000000";

      for (let attempt = 1; attempt < PHONE_OTP_MAX_ATTEMPTS; attempt++) {
        await expect(service.verify(context, wrongCode)).rejects.toBeInstanceOf(HttpException);
      }

      await expect(service.verify(context, code)).resolves.toBeUndefined();
    });

    it("fails closed when the OTP secret is missing", async () => {
      const originalJwtSecret = process.env.JWT_SECRET;

      delete process.env.PHONE_OTP_SECRET;
      delete process.env.JWT_SECRET;

      try {
        expect(() => service.hashCode(context, "123456")).toThrow(
          "Phone OTP secret is not configured",
        );
      } finally {
        if (originalJwtSecret !== undefined) process.env.JWT_SECRET = originalJwtSecret;
      }
    });
  });

  describe("reserveSendSlot", () => {
    it(`enforces a ${PHONE_OTP_RESEND_COOLDOWN_SECONDS}s resend cooldown per phone`, async () => {
      await service.reserveSendSlot(context.phone);

      const error = await expectHttpError(
        service.reserveSendSlot(context.phone),
        HttpStatus.TOO_MANY_REQUESTS,
        PHONE_AUTH_ERRORS.RESEND_COOLDOWN,
      );

      expect((error.getResponse() as { retryAfterSeconds: number }).retryAfterSeconds).toBe(
        PHONE_OTP_RESEND_COOLDOWN_SECONDS,
      );

      // Other numbers are not affected.
      await expect(service.reserveSendSlot("+79160000000")).resolves.toBeUndefined();

      jest.advanceTimersByTime(PHONE_OTP_RESEND_COOLDOWN_SECONDS * 1000);

      await expect(service.reserveSendSlot(context.phone)).resolves.toBeUndefined();
    });

    it(`allows at most ${PHONE_OTP_MAX_CODES_PER_WINDOW} codes per hour per phone`, async () => {
      for (let sent = 0; sent < PHONE_OTP_MAX_CODES_PER_WINDOW; sent++) {
        await service.reserveSendSlot(context.phone);
        jest.advanceTimersByTime(PHONE_OTP_RESEND_COOLDOWN_SECONDS * 1000);
      }

      await expectHttpError(
        service.reserveSendSlot(context.phone),
        HttpStatus.TOO_MANY_REQUESTS,
        PHONE_AUTH_ERRORS.TOO_MANY_CODES,
      );

      jest.advanceTimersByTime(60 * 60 * 1000);

      await expect(service.reserveSendSlot(context.phone)).resolves.toBeUndefined();
    });

    it("releaseCooldown lets the user retry immediately", async () => {
      await service.reserveSendSlot(context.phone);
      await service.releaseCooldown(context.phone);

      await expect(service.reserveSendSlot(context.phone)).resolves.toBeUndefined();
    });
  });
});
