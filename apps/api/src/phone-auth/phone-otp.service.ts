import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { REDIS_CLIENT } from "src/redis/redis.tokens";
import { RedisClient } from "src/redis/redis.types";

import { readPhoneAuthConfig } from "./phone-auth.config";
import {
  PHONE_AUTH_ERRORS,
  PHONE_OTP_CODE_LENGTH,
  PHONE_OTP_CODES_WINDOW_SECONDS,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_MAX_CODES_PER_WINDOW,
  PHONE_OTP_REDIS_PREFIX,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_OTP_TTL_SECONDS,
} from "./phone-auth.constants";

import type { PhoneOtpContext } from "./phone-auth.types";

const HASH_FIELD = "hash";
const ATTEMPTS_FIELD = "attempts";

const tooManyRequests = (message: string, retryAfterSeconds: number) =>
  new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );

/**
 * One-time codes for phone verification, stored in Redis:
 * - only an HMAC-SHA256 of the code is stored (never the code itself);
 * - the code key is scoped by tenant + purpose (+ subject) + phone and expires after 5 minutes;
 * - at most 5 verification attempts per code, compared in constant time, deleted on success;
 * - sending is throttled per phone number (60 s cooldown, max 5 codes per hour).
 */
@Injectable()
export class PhoneOtpService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  /**
   * Reserves a send slot for the phone. Throws 429 when the resend cooldown is active or the
   * hourly budget is exhausted. Applied before any user lookup so responses do not reveal
   * whether a number is registered.
   */
  async reserveSendSlot(phone: string): Promise<void> {
    const cooldownKey = this.getCooldownKey(phone);

    const reserved = await this.redis.set(cooldownKey, "1", {
      NX: true,
      EX: PHONE_OTP_RESEND_COOLDOWN_SECONDS,
    });

    if (reserved !== "OK") {
      const ttl = await this.redis.ttl(cooldownKey);
      throw tooManyRequests(
        PHONE_AUTH_ERRORS.RESEND_COOLDOWN,
        ttl > 0 ? ttl : PHONE_OTP_RESEND_COOLDOWN_SECONDS,
      );
    }

    const windowKey = this.getWindowKey(phone);
    const sentInWindow = await this.redis.incr(windowKey);

    if (sentInWindow === 1) await this.redis.expire(windowKey, PHONE_OTP_CODES_WINDOW_SECONDS);

    if (sentInWindow > PHONE_OTP_MAX_CODES_PER_WINDOW) {
      const ttl = await this.redis.ttl(windowKey);
      throw tooManyRequests(
        PHONE_AUTH_ERRORS.TOO_MANY_CODES,
        ttl > 0 ? ttl : PHONE_OTP_CODES_WINDOW_SECONDS,
      );
    }
  }

  /** Releases the resend cooldown, e.g. when the SMS could not be sent at all. */
  async releaseCooldown(phone: string): Promise<void> {
    await this.redis.del(this.getCooldownKey(phone));
  }

  /** Generates a new code for the context (replacing any previous one) and returns it. */
  async issue(context: PhoneOtpContext): Promise<string> {
    const code = this.generateCode();
    const key = this.getCodeKey(context);

    await this.redis
      .multi()
      .del(key)
      .hSet(key, { [HASH_FIELD]: this.hashCode(context, code), [ATTEMPTS_FIELD]: "0" })
      .expire(key, PHONE_OTP_TTL_SECONDS)
      .exec();

    return code;
  }

  async invalidate(context: PhoneOtpContext): Promise<void> {
    await this.redis.del(this.getCodeKey(context));
  }

  /**
   * Verifies a code. Throws when there is no active code, the code is wrong, or the attempt
   * budget is exhausted. A successful verification consumes the code (single use).
   */
  async verify(context: PhoneOtpContext, code: string): Promise<void> {
    const key = this.getCodeKey(context);
    const storedHash = await this.redis.hGet(key, HASH_FIELD);

    if (!storedHash) throw new UnauthorizedException(PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE);

    const attempts = await this.redis.hIncrBy(key, ATTEMPTS_FIELD, 1);

    if (attempts > PHONE_OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      throw new BadRequestException(PHONE_AUTH_ERRORS.TOO_MANY_ATTEMPTS);
    }

    const isValid = this.isSameHash(storedHash, this.hashCode(context, code));

    if (!isValid) {
      if (attempts >= PHONE_OTP_MAX_ATTEMPTS) {
        await this.redis.del(key);
        throw new BadRequestException(PHONE_AUTH_ERRORS.TOO_MANY_ATTEMPTS);
      }

      throw new UnauthorizedException(PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE);
    }

    // DEL returns 0 when a concurrent request already consumed the code.
    const deleted = await this.redis.del(key);

    if (deleted !== 1) throw new UnauthorizedException(PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE);
  }

  hashCode(context: PhoneOtpContext, code: string): string {
    const secret = readPhoneAuthConfig().otpSecret;

    if (!secret) throw new Error("Phone OTP secret is not configured");

    return createHmac("sha256", secret)
      .update(
        [context.tenantId, context.purpose, context.subjectId ?? "", context.phone, code].join(":"),
      )
      .digest("hex");
  }

  private generateCode(): string {
    const max = 10 ** PHONE_OTP_CODE_LENGTH;

    return randomInt(0, max).toString().padStart(PHONE_OTP_CODE_LENGTH, "0");
  }

  private isSameHash(storedHash: string, candidateHash: string): boolean {
    const stored = Buffer.from(storedHash, "hex");
    const candidate = Buffer.from(candidateHash, "hex");

    if (stored.length !== candidate.length) return false;

    return timingSafeEqual(stored, candidate);
  }

  private getCodeKey({ tenantId, purpose, subjectId, phone }: PhoneOtpContext): string {
    return [PHONE_OTP_REDIS_PREFIX, "code", tenantId, purpose, subjectId ?? "-", phone].join(":");
  }

  private getCooldownKey(phone: string): string {
    return [PHONE_OTP_REDIS_PREFIX, "cooldown", phone].join(":");
  }

  private getWindowKey(phone: string): string {
    return [PHONE_OTP_REDIS_PREFIX, "window", phone].join(":");
  }
}
