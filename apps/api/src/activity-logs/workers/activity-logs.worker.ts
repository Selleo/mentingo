import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { buildRedisConnection } from "src/common/configuration/redis";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { Job } from "bullmq";
import type { RecordActivityLogInput } from "src/activity-logs/activity-logs.service";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class ActivityLogsWorker implements OnModuleDestroy {
  private readonly logger = new Logger(ActivityLogsWorker.name);
  private readonly worker: Worker<RecordActivityLogInput>;

  constructor(
    private readonly configService: ConfigService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.worker = new Worker(
      "activity-logs",
      async (job: Job<RecordActivityLogInput>) => {
        if (!job.data.tenantId) {
          this.logger.warn(`Skipping activity log job ${job.id} because tenantId is missing`);
          return;
        }

        await this.tenantRunner.runWithTenant(job.data.tenantId, async () => {
          await this.activityLogsService.persistActivityLog(job.data);
        });
      },
      {
        connection,
        concurrency:
          process.env.NODE_ENV === "test" ? 1 : Number(process.env.WORKER_CONCURRENCY || 10),
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
