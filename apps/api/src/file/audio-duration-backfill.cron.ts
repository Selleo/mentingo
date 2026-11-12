import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { VIDEO_PROVIDERS } from "@repo/shared";

import { isQueueSandboxProcess } from "src/queue/queue.constants";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { VideoMetadataQueueService } from "./video-metadata.queue.service";
import { VideoMetadataRepository } from "./video-metadata.repository";

import type { UUIDType } from "src/common";

const AUDIO_DURATION_BACKFILL_BATCH_SIZE = 100;

@Injectable()
export class AudioDurationBackfillCron {
  private readonly logger = new Logger(AudioDurationBackfillCron.name);
  private isBackfillRunning = false;
  private readonly afterIdByTenant = new Map<string, string>();

  constructor(
    private readonly videoMetadataRepository: VideoMetadataRepository,
    private readonly videoMetadataQueueService: VideoMetadataQueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async enqueueMissingAudioDurations(): Promise<void> {
    if (this.isBackfillRunning || isQueueSandboxProcess()) return;

    this.isBackfillRunning = true;

    try {
      await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
        try {
          await this.enqueueTenantAudioDurationPage(tenantId);
        } catch (error) {
          this.logger.error(
            `Audio duration backfill failed for tenant ${tenantId}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      });
    } finally {
      this.isBackfillRunning = false;
    }
  }

  private async enqueueTenantAudioDurationPage(tenantId: UUIDType) {
    const candidates = await this.videoMetadataRepository.findAudioMissingDuration(
      tenantId,
      this.afterIdByTenant.get(tenantId),
      AUDIO_DURATION_BACKFILL_BATCH_SIZE,
    );

    if (!candidates.length) {
      this.afterIdByTenant.delete(tenantId);
      return;
    }

    for (const resource of candidates) {
      await this.videoMetadataQueueService.enqueueReady({
        tenantId,
        resourceId: resource.id,
        provider: VIDEO_PROVIDERS.S3,
        fileKey: resource.reference,
      });
      this.afterIdByTenant.set(tenantId, resource.id);
    }
  }
}
