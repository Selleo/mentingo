import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";

import { buildRedisConnection } from "src/common/configuration/redis";

import type { RecordActivityLogInput } from "./activity-logs.service";
import type { OnModuleDestroy } from "@nestjs/common";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class ActivityLogsQueueService implements OnModuleDestroy {
  private readonly queue: Queue<RecordActivityLogInput>;

  constructor(private readonly configService: ConfigService) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.queue = new Queue<RecordActivityLogInput>("activity-logs", {
      connection,
    });
  }

  async enqueueActivityLog(payload: RecordActivityLogInput) {
    return this.queue.add("record-activity-log", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: true,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
