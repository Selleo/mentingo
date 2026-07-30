import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";

import { DatabasePg } from "src/common";
import { buildRedisConnection } from "src/common/configuration/redis";
import { OutboxRepository } from "src/outbox/outbox.repository";
import { SettingsService } from "src/settings/settings.service";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { GamificationRepository } from "./gamification.repository";
import { GamificationService } from "./gamification.service";

import type { AchievementLevel } from "./gamification.types";
import type { SupportedLanguages } from "@repo/shared";
import type { Job } from "bullmq";
import type { RedisConfigSchema } from "src/common/configuration/redis";
import type { GamificationEventPayload } from "src/websocket";

export type WebsocketNotificationType = {
  userAchievementId: string;
  level: AchievementLevel;
};

@Injectable()
export class GamificationWorker implements OnModuleDestroy {
  private readonly logger = new Logger(GamificationWorker.name);
  private readonly worker: Worker<GamificationEventPayload>;

  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly configService: ConfigService,
    private readonly gamificationRepository: GamificationRepository,
    private readonly gamificationService: GamificationService,
    private readonly settingsService: SettingsService,
    private readonly outboxRepository: OutboxRepository,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {
    const redisCfg = this.configService.get("redis") as RedisConfigSchema;
    const connection = redisCfg && buildRedisConnection(redisCfg);

    this.worker = new Worker<GamificationEventPayload>(
      "gamification-events",
      async (job: Job<GamificationEventPayload>) => {
        const event = job.data;
        if (!event.resourceType || !event.userId) return;

        await this.tenantRunner.runWithTenant(event.tenantId, async () => {
          await this.processEvent(event);
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
    });
  }

  private async processEvent(event: GamificationEventPayload) {
    const userLanguage = (await this.settingsService.getUserSettings(event.userId))
      .language as SupportedLanguages;
    const notifications: WebsocketNotificationType[] = [];

    await this.db
      .transaction(async (tx) => {
        const achievementsList = await this.gamificationRepository.getAchievementsForEvent(
          event.tenantId,
          event.resourceType!,
          event.canViewHidden,
          tx,
        );

        for (const achievement of achievementsList) {
          const levels = await this.gamificationRepository.getAchievementLevelsWithName(
            achievement.id,
            userLanguage,
            tx,
          );

          const actualThreshold = await this.gamificationService.resolveThreshold(event, tx);
          if (actualThreshold === null) continue;

          const newAchievement = await this.gamificationService.processAchievements(
            levels,
            actualThreshold,
            event,
            tx,
          );

          if (newAchievement) notifications.push(newAchievement);
        }

        const isFirstProcessing = await this.outboxRepository.markProcessedOrSkip(
          event.sourceId,
          event.tenantId,
          tx,
        );

        if (!isFirstProcessing) {
          this.logger.warn(`Event ${event.sourceId} already processed`);
          throw new Error("ROLLBACK_DUPLICATE");
        }
      })
      .catch((err) => {
        if (err.message === "ROLLBACK_DUPLICATE") {
          notifications.length = 0;
          return;
        }
        throw err;
      });

    for (const notification of notifications) {
      this.gamificationService.emitAchievementNotification(event.userId, notification);
    }
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
