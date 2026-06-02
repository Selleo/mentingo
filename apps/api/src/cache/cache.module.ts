import KeyvRedis, { Keyv } from "@keyv/redis";
import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCache } from "cache-manager";

import { CACHE_MANAGER_TOKEN, type Cache } from "./cache.types";

const REDIS_STORE = "REDIS_STORE";

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      inject: [ConfigService],
      provide: REDIS_STORE,
      useFactory: (configService: ConfigService) => {
        return new KeyvRedis(configService.get<string>("REDIS_URL"));
      },
    },
    {
      inject: [REDIS_STORE],
      provide: CACHE_MANAGER_TOKEN,
      useFactory: (redisStore: KeyvRedis) =>
        createCache({
          stores: [new Keyv({ store: redisStore })],
        }),
    },
    {
      inject: [CACHE_MANAGER_TOKEN],
      provide: "CACHE_MANAGER",
      useFactory: (cacheManager: Cache) => cacheManager,
    },
  ],
  exports: ["CACHE_MANAGER", CACHE_MANAGER_TOKEN],
})
export class CacheModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_STORE) private readonly redisStore: KeyvRedis) {}

  async onModuleDestroy() {
    await this.redisStore.disconnect();
  }
}
