import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AUTH_ERROR_KEYS } from "@repo/shared";
import { chunk } from "lodash";
import { nanoid } from "nanoid";

import { REFRESH_TOKEN_EXPIRATION_SECONDS } from "src/auth/consts";
import { REDIS_CLIENT } from "src/redis/redis.tokens";
import { RedisClient } from "src/redis/redis.types";

import type {
  AccessTokenIdentity,
  ActiveAccessTokenIdentity,
  InactiveAccessTokens,
  SessionIdentity,
} from "./session-revocation.types";

/** No access token outlives its refresh token, so the version must live at least that long. */
const ACCESS_VERSION_TTL_SECONDS = REFRESH_TOKEN_EXPIRATION_SECONDS;

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

  /**
   * The version every access token minted now must carry, created when missing and kept alive at
   * least as long as any token minted with it. Read it before the user's permissions, so a token
   * can never pair new permissions with an outdated version.
   */
  async ensureUserAccessVersion(userId: string): Promise<string> {
    const accessVersion = await this.redisClient.eval(
      `redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
       redis.call('EXPIRE', KEYS[1], ARGV[2], 'GT')
       return redis.call('GET', KEYS[1])`,
      {
        keys: [this.getUserAccessVersionKey(userId)],
        arguments: [nanoid(32), String(ACCESS_VERSION_TTL_SECONDS)],
      },
    );

    if (typeof accessVersion !== "string")
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);

    return accessVersion;
  }

  /** Rejects the user's existing access tokens while keeping sessions, so a refresh mints fresh ones. */
  async rotateUserAccessVersion(userId: string): Promise<void> {
    await this.redisClient.set(this.getUserAccessVersionKey(userId), nanoid(32), {
      EX: ACCESS_VERSION_TTL_SECONDS,
    });
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

    const [userVersion, sessionRecordVersion] = await this.redisClient.mGet([
      this.getUserVersionKey(userId),
      this.getSessionKey(userId, sessionId),
    ]);
    if (userVersion !== sessionVersion || sessionRecordVersion !== sessionVersion)
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);
  }

  /**
   * Checks an access token's session and its access version with one Redis round-trip. A missing or
   * outdated access version only expires the token, so the session can still be refreshed.
   */
  async assertAccessTokenActive({
    userId,
    sessionId,
    sessionVersion,
    accessVersion,
  }: AccessTokenIdentity): Promise<void> {
    if (!sessionId || !sessionVersion)
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);

    const [userVersion, sessionRecordVersion, currentAccessVersion] = await this.redisClient.mGet([
      this.getUserVersionKey(userId),
      this.getSessionKey(userId, sessionId),
      this.getUserAccessVersionKey(userId),
    ]);

    if (userVersion !== sessionVersion || sessionRecordVersion !== sessionVersion)
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_REVOKED);

    if (!accessVersion || currentAccessVersion !== accessVersion)
      throw new UnauthorizedException(AUTH_ERROR_KEYS.SESSION_EXPIRED);
  }

  /**
   * Sorts out the access tokens whose session was revoked and those whose access version is outdated,
   * checked with one Redis round-trip. The rules match `assertAccessTokenActive`.
   */
  async findInactiveAccessTokens<T extends ActiveAccessTokenIdentity>(
    identities: T[],
  ): Promise<InactiveAccessTokens<T>> {
    const inactiveAccessTokens: InactiveAccessTokens<T> = { revoked: [], expired: [] };
    if (!identities.length) return inactiveAccessTokens;

    const storedValues = await this.redisClient.mGet(
      identities.flatMap(({ userId, sessionId }) => [
        this.getUserVersionKey(userId),
        this.getSessionKey(userId, sessionId),
        this.getUserAccessVersionKey(userId),
      ]),
    );
    const storedVersions = chunk(storedValues, 3);

    identities.forEach((identity, index) => {
      const [userVersion, sessionRecordVersion, currentAccessVersion] = storedVersions[index];

      if (
        userVersion !== identity.sessionVersion ||
        sessionRecordVersion !== identity.sessionVersion
      )
        inactiveAccessTokens.revoked.push(identity);
      else if (!identity.accessVersion || currentAccessVersion !== identity.accessVersion)
        inactiveAccessTokens.expired.push(identity);
    });

    return inactiveAccessTokens;
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

  private getUserAccessVersionKey(userId: string) {
    return `auth:access-version:${userId}`;
  }

  private getSessionKey(userId: string, sessionId: string) {
    return `auth:session:${userId}:${sessionId}`;
  }
}
