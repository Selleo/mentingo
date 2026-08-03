import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";

import { buildRedisConnection } from "src/common/configuration/redis";

import type { OnModuleDestroy } from "@nestjs/common";
import type { RedisConfigSchema } from "src/common/configuration/redis";
import type { GamificationEventPayload } from "src/websocket";

@Injectable()
export class GamificationQueueService implements OnModuleDestroy {
  private readonly queue: Queue<GamificationEventPayload>;

  constructor(private readonly configService: ConfigService) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.queue = new Queue<GamificationEventPayload>("gamification-events", {
      connection,
    });
  }

  async enqueueEvent(payload: GamificationEventPayload) {
    return this.queue.add("process-event", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: true,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
