import { Global, Inject, Injectable, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";

import {
  REDIS_CLIENT,
  REDIS_EVENTS_SUBSCRIBER_CLIENT,
  REDIS_PUBLISHER_CLIENT,
  REDIS_SUBSCRIBER_CLIENT,
} from "src/redis/redis.tokens";
import { RedisClient } from "src/redis/redis.types";
import { SessionRevocationService } from "src/redis/session-revocation.service";

import type { OnApplicationShutdown } from "@nestjs/common";
import type { RedisClientType } from "redis";
import type { RedisConfigSchema } from "src/common/configuration/redis";

const connectRedisClient = async (redisUrl: string): Promise<RedisClient> => {
  if (!redisUrl) {
    throw new Error("Redis URL is required");
  }

  const client = createClient({ url: redisUrl }) as RedisClientType;
  await client.connect();

  return client;
};

@Injectable()
class RedisClientsLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisClientsLifecycle.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClient,
    @Inject(REDIS_PUBLISHER_CLIENT) private readonly publisherClient: RedisClient,
    @Inject(REDIS_SUBSCRIBER_CLIENT) private readonly subscriberClient: RedisClient,
    @Inject(REDIS_EVENTS_SUBSCRIBER_CLIENT)
    private readonly eventsSubscriberClient: RedisClient,
  ) {}

  async onApplicationShutdown() {
    await Promise.all([
      this.safeQuit(this.client, "client"),
      this.safeQuit(this.publisherClient, "publisherClient"),
      this.safeQuit(this.subscriberClient, "subscriberClient"),
      this.safeQuit(this.eventsSubscriberClient, "eventsSubscriberClient"),
    ]);
  }

  private async safeQuit(client: RedisClient, name: string) {
    if (!client.isOpen) return;

    try {
      await client.quit();
    } catch (error) {
      this.logger.warn(`Failed to close redis ${name}: ${String(error)}`);
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisCfg = configService.get("redis") as RedisConfigSchema;
        return await connectRedisClient(redisCfg.REDIS_URL);
      },
    },
    {
      provide: REDIS_PUBLISHER_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisCfg = configService.get("redis") as RedisConfigSchema;
        return await connectRedisClient(redisCfg.REDIS_URL);
      },
    },
    {
      provide: REDIS_SUBSCRIBER_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisCfg = configService.get("redis") as RedisConfigSchema;
        return await connectRedisClient(redisCfg.REDIS_URL);
      },
    },
    {
      provide: REDIS_EVENTS_SUBSCRIBER_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisCfg = configService.get("redis") as RedisConfigSchema;
        return await connectRedisClient(redisCfg.REDIS_URL);
      },
    },
    SessionRevocationService,
    RedisClientsLifecycle,
  ],
  exports: [
    REDIS_CLIENT,
    REDIS_PUBLISHER_CLIENT,
    REDIS_SUBSCRIBER_CLIENT,
    REDIS_EVENTS_SUBSCRIBER_CLIENT,
    SessionRevocationService,
  ],
})
export class RedisClientsModule {}
