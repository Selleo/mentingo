import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { buildRedisConnection } from "src/common/configuration/redis";

import type { Job } from "bullmq";
import type { RecordActivityLogInput } from "src/activity-logs/activity-logs.service";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class ActivityLogsWorker implements OnModuleDestroy {
  private readonly worker: Worker<RecordActivityLogInput>;

  constructor(
    private readonly configService: ConfigService,
    private readonly activityLogsService: ActivityLogsService,
  ) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.worker = new Worker(
      "activity-logs",
      async (job: Job<RecordActivityLogInput>) =>
        this.activityLogsService.persistActivityLog(job.data),
      {
        connection,
        concurrency: Number(process.env.WORKER_CONCURRENCY || 10),
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
