import KeyvRedis, { Keyv } from "@keyv/redis";
import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCache } from "cache-manager";

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
      provide: "CACHE_MANAGER",
      useFactory: (redisStore: KeyvRedis) =>
        createCache({
          stores: [new Keyv({ store: redisStore })],
        }),
    },
  ],
  exports: ["CACHE_MANAGER"],
})
export class CacheModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_STORE) private readonly redisStore: KeyvRedis) {}

  async onModuleDestroy() {
    await this.redisStore.disconnect();
  }
}
