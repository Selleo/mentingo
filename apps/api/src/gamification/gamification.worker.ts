import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";

import { buildRedisConnection } from "src/common/configuration/redis";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { GamificationHandler } from "./gamification.handler";

import type { Job } from "bullmq";
import type { RedisConfigSchema } from "src/common/configuration/redis";
import type { GamificationEventPayload } from "src/websocket";

@Injectable()
export class GamificationWorker implements OnModuleDestroy {
  private readonly logger = new Logger(GamificationWorker.name);
  private readonly worker: Worker<GamificationEventPayload>;

  constructor(
    private readonly configService: ConfigService,
    private readonly gamificationHandler: GamificationHandler,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.worker = new Worker<GamificationEventPayload>(
      "gamification-events",
      async (job: Job<GamificationEventPayload>) => {
        const event = job.data;
        if (!event.resourceType) throw new Error("common.error.somethingWentWrong");
        await this.tenantRunner.runWithTenant(event.tenantId, async () => {
          this.logger.log(`Processing gamification event: ${event.actionType}`);
          await new Promise((resolve) => setTimeout(resolve, 500));

          await this.gamificationHandler.handle(event);
          return;
        });
      },
      {
        connection,
        concurrency:
          process.env.NODE_ENV === "test"
            ? 1
            : Number(process.env.GAMIFICATION_WORKER_CONCURRENCY || 10),
      },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error(`Gamification job failed ${job?.id}`, error);
      console.error(error);
      console.error(error.stack);
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
