import { Inject, Injectable } from "@nestjs/common";

import { REDIS_CLIENT } from "src/redis/redis.tokens";
import { RedisClient } from "src/redis/redis.types";

import type { UUIDType } from "src/common";

const SESSION_REVOKED_KEY_PREFIX = "session:revoked:user";

@Injectable()
export class SessionRevocationService {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: RedisClient) {}

  async revokeUserSessions(userId: UUIDType | string): Promise<void> {
    await this.redisClient.set(this.getKey(userId), "1");
  }

  async isUserRevoked(userId: UUIDType | string): Promise<boolean> {
    const exists = await this.redisClient.exists(this.getKey(userId));
    return exists === 1;
  }

  async clearUserRevocation(userId: UUIDType | string): Promise<void> {
    await this.redisClient.del(this.getKey(userId));
  }

  private getKey(userId: UUIDType | string): string {
    return `${SESSION_REVOKED_KEY_PREFIX}:${userId}`;
  }
}
