import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { VIDEO_PROVIDERS } from "@repo/shared";

import { isQueueSandboxProcess } from "src/queue/queue.constants";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { VideoMetadataQueueService } from "./video-metadata.queue.service";
import { VideoMetadataRepository } from "./video-metadata.repository";

const AUDIO_DURATION_BACKFILL_BATCH_SIZE = 100;

/** Upgrades legacy audio via the existing metadata worker and duration-updated outbox event. */
@Injectable()
export class AudioDurationBackfillCron {
  private running = false;
  private readonly afterIdByTenant = new Map<string, string>();

  constructor(
    private readonly videoMetadataRepository: VideoMetadataRepository,
    private readonly videoMetadataQueueService: VideoMetadataQueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async enqueueMissingAudioDurations(): Promise<void> {
    if (this.running || process.env.BUILD_VERIFICATION === "true" || isQueueSandboxProcess())
      return;
    this.running = true;
    try {
      await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
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
          // Advance only after enqueue succeeds. Stable job IDs deduplicate replicas/restarts.
          this.afterIdByTenant.set(tenantId, resource.id);
        }
      });
    } finally {
      this.running = false;
    }
  }
}
