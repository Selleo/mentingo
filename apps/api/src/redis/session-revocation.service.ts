import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AUTH_ERROR_KEYS } from "@repo/shared";
import { chunk } from "lodash";
import { nanoid } from "nanoid";

import { REFRESH_TOKEN_EXPIRATION_SECONDS } from "src/auth/consts";
import { REDIS_CLIENT } from "src/redis/redis.tokens";
import { RedisClient } from "src/redis/redis.types";

import type { ActiveSessionIdentity, SessionIdentity } from "./session-revocation.types";

@Injectable()
export class SessionRevocationService {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: RedisClient) {}

  async getOrCreateUserSessionVersion(userId: string): Promise<string> {
    const key = this.getUserVersionKey(userId);
    await this.redisClient.set(key, nanoid(32), { NX: true });
    const version = await this.redisClient.get(key);
    if (!version) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);
    return version;
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.redisClient.set(this.getUserVersionKey(userId), nanoid(32));
  }

  async assertUserSessionVersion(userId: string, version?: string): Promise<void> {
    if (!version || (await this.redisClient.get(this.getUserVersionKey(userId))) !== version)
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);
  }

  async createSession(
    userId: string,
    expectedVersion?: string,
    expiresInSeconds = REFRESH_TOKEN_EXPIRATION_SECONDS,
  ) {
    const sessionVersion = expectedVersion ?? (await this.getOrCreateUserSessionVersion(userId));
    const sessionId = nanoid(32);
    const created = await this.redisClient.eval(
      `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
       return redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2], 'NX')`,
      {
        keys: [this.getUserVersionKey(userId), this.getSessionKey(userId, sessionId)],
        arguments: [sessionVersion, String(expiresInSeconds)],
      },
    );
    if (created !== "OK") throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);
    return { sessionId, sessionVersion };
  }

  async assertSessionActive({ userId, sessionId, sessionVersion }: SessionIdentity): Promise<void> {
    if (!sessionId || !sessionVersion)
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);

    const [inactiveSession] = await this.findInactiveSessions([
      { userId, sessionId, sessionVersion },
    ]);
    if (inactiveSession) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);
  }

  /** Returns the identities whose session was revoked or expired, checked with one Redis round-trip. */
  async findInactiveSessions<T extends ActiveSessionIdentity>(identities: T[]): Promise<T[]> {
    if (!identities.length) return [];

    const storedValues = await this.redisClient.mGet(
      identities.flatMap(({ userId, sessionId }) => [
        this.getUserVersionKey(userId),
        this.getSessionKey(userId, sessionId),
      ]),
    );
    const storedVersionPairs = chunk(storedValues, 2);

    return identities.filter(({ sessionVersion }, index) => {
      const [userVersion, sessionRecordVersion] = storedVersionPairs[index];
      return userVersion !== sessionVersion || sessionRecordVersion !== sessionVersion;
    });
  }

  async extendSession(
    identity: SessionIdentity,
    expiresInSeconds = REFRESH_TOKEN_EXPIRATION_SECONDS,
  ) {
    if (!identity.sessionId || !identity.sessionVersion)
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);

    const extended = await this.redisClient.eval(
      `if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
       return redis.call('EXPIRE', KEYS[2], ARGV[2])`,
      {
        keys: [
          this.getUserVersionKey(identity.userId),
          this.getSessionKey(identity.userId, identity.sessionId),
        ],
        arguments: [identity.sessionVersion, String(expiresInSeconds)],
      },
    );
    if (Number(extended) !== 1) throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);
    return { sessionId: identity.sessionId, sessionVersion: identity.sessionVersion };
  }

  async revokeSession(identity: SessionIdentity): Promise<void> {
    if (identity.sessionId)
      await this.redisClient.del(this.getSessionKey(identity.userId, identity.sessionId));
  }

  private getUserVersionKey(userId: string) {
    return `auth:session-version:${userId}`;
  }

  private getSessionKey(userId: string, sessionId: string) {
    return `auth:session:${userId}:${sessionId}`;
  }
}
