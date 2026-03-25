import { Injectable } from "@nestjs/common";

import { RedisClient } from "src/redis";

import type { ThrottleResult } from "./rate-limit.types";
import type { ThrottlerStorage } from "@nestjs/throttler";

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redisClient: RedisClient) {}

  public async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottleResult> {
    const storageKey = `rate-limit:throttler:${throttlerName}:${key}`;
    const totalHits = await this.redisClient.incr(storageKey);

    if (totalHits === 1) await this.redisClient.pExpire(storageKey, ttl);

    const ttlMs = await this.redisClient.pTTL(storageKey);
    const ttlSeconds = Math.max(0, Math.ceil(Math.max(0, ttlMs) / 1000));
    const isBlocked = totalHits > limit;

    return {
      totalHits,
      timeToExpire: ttlSeconds,
      isBlocked,
      timeToBlockExpire: isBlocked ? ttlSeconds : 0,
    };
  }
}
