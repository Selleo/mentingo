import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { buildRedisConnection } from "src/common/configuration/redis";
import { GamificationQueueService } from "src/gamification/gamification-queue.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { Job } from "bullmq";
import type { RecordActivityLogInput } from "src/activity-logs/activity-logs.types";
import type { RedisConfigSchema } from "src/common/configuration/redis";

@Injectable()
export class ActivityLogsWorker implements OnModuleDestroy {
  private readonly logger = new Logger(ActivityLogsWorker.name);
  private readonly worker: Worker<RecordActivityLogInput>;

  constructor(
    private readonly configService: ConfigService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly tenantRunner: TenantDbRunnerService,
    private readonly gamificationQueueService: GamificationQueueService,
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

        const activityLog = await this.tenantRunner.runWithTenant(job.data.tenantId, async () => {
          return await this.activityLogsService.persistActivityLogAndReturn(job.data);
        });

        await this.gamificationQueueService.enqueueEvent({
          tenantId: job.data.tenantId,
          userId: activityLog.actorId,
          actorRole: activityLog.actorRole,
          actionType: activityLog.actionType,
          resourceType: activityLog.resourceType,
          sourceId: activityLog.id,
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
