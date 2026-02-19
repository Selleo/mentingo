import { createClient } from "redis";

import type { RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;

const getRedisUrl = () => process.env.REDIS_URL || "";

export const getRedisClient = async (): Promise<RedisClientType | null> => {
  const redisUrl = getRedisUrl();

  if (!redisUrl) return null;

  if (!redisClient) {
    redisClient = createClient({ url: redisUrl }) as RedisClientType;
    redisClient.on("error", () => undefined);
  }

  if (redisClient.isOpen) return redisClient;

  if (connectPromise) return connectPromise;

  connectPromise = redisClient
    .connect()
    .then(() => redisClient)
    .catch(() => null)
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

export const getCachedJson = async <T>(key: string): Promise<T | null> => {
  const redisClient = await getRedisClient();
  if (!redisClient) return null;

  const cached = await redisClient.get(key);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached) as T;
    return parsed;
  } catch {
    return null;
  }
};

export const setCachedJson = async (key: string, value: unknown, ttlSeconds: number) => {
  const redisClient = await getRedisClient();
  if (!redisClient) return;

  await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
};

export const deleteCacheKey = async (key: string) => {
  const redisClient = await getRedisClient();
  if (!redisClient) return;

  await redisClient.del(key);
};
