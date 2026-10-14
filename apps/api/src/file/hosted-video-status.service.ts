import { Injectable, Logger } from "@nestjs/common";
import { VIDEO_PROCESSING_STATUSES, VIDEO_PROVIDERS } from "@repo/shared";
import { match } from "ts-pattern";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  HOSTED_VIDEO_PROCESSING_TIMEOUT_MS,
  HOSTED_VIDEO_STATUS_CHECK_BATCH_SIZE,
  HOSTED_VIDEO_STATUS_CHECK_INTERVAL_MS,
  HOSTED_VIDEO_STATUSES,
} from "./hosted-video.constants";
import { HostedVideoRepository } from "./hosted-video.repository";
import { mapBunnyStatusToHostedVideoStatus } from "./video-metadata.utils";

import type { HostedVideo, HostedVideoStatus } from "./hosted-video.types";
import type { VideoProcessingStatus, VideoProviderType } from "@repo/shared";

/** Keeps the processing status of hosted videos in step with their streaming provider. */
@Injectable()
export class HostedVideoStatusService {
  private readonly logger = new Logger(HostedVideoStatusService.name);

  constructor(
    private readonly hostedVideoRepository: HostedVideoRepository,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async findHostedVideo(provider: VideoProviderType, providerVideoId: string) {
    return this.hostedVideoRepository.findByProviderVideoId(provider, providerVideoId);
  }

  /** Returns how far each not-yet-playable video of the current tenant is, keyed by reference. */
  async findProcessingStatusesInCurrentTenant(
    references: string[],
  ): Promise<Map<string, VideoProcessingStatus>> {
    const tenantId = dbAls.getStore()?.tenantId;
    if (!tenantId) return new Map();

    const hostedVideos = await this.hostedVideoRepository.findStatusesByReferences(
      tenantId,
      references,
    );

    return new Map(
      hostedVideos.flatMap(({ reference, status }) => {
        const processingStatus = this.toVideoProcessingStatus(status);
        return reference && processingStatus ? [[reference, processingStatus] as const] : [];
      }),
    );
  }

  async recordBunnyStatus(hostedVideo: HostedVideo, bunnyStatus: number): Promise<void> {
    await this.hostedVideoRepository.updateStatus(
      hostedVideo.id,
      mapBunnyStatusToHostedVideoStatus(bunnyStatus),
    );
  }

  async recordProviderVideoReady(provider: VideoProviderType, providerVideoId: string) {
    const hostedVideo = await this.findHostedVideo(provider, providerVideoId);
    if (!hostedVideo) return;

    await this.hostedVideoRepository.updateStatus(hostedVideo.id, HOSTED_VIDEO_STATUSES.READY);
  }

  /**
   * Asks the provider about videos whose webhook may have been lost, and fails videos that
   * have not become ready within the processing timeout so the next transfer uploads them again.
   */
  async checkUnfinishedVideoStatuses(): Promise<void> {
    const unfinishedVideos = await this.hostedVideoRepository.claimUnfinishedVideosForStatusCheck(
      new Date(Date.now() - HOSTED_VIDEO_STATUS_CHECK_INTERVAL_MS),
      HOSTED_VIDEO_STATUS_CHECK_BATCH_SIZE,
    );

    for (const hostedVideo of unfinishedVideos) {
      await this.checkVideoStatus(hostedVideo).catch(() =>
        this.logger.warn(`Could not check the status of hosted video ${hostedVideo.id}`),
      );
    }
  }

  private async checkVideoStatus(hostedVideo: HostedVideo): Promise<void> {
    if (this.hasExceededProcessingTimeout(hostedVideo)) {
      await this.hostedVideoRepository.updateStatus(hostedVideo.id, HOSTED_VIDEO_STATUSES.FAILED);
      return;
    }

    if (hostedVideo.status !== HOSTED_VIDEO_STATUSES.PROCESSING || !hostedVideo.providerVideoId) {
      return;
    }

    const { providerVideoId } = hostedVideo;

    await match(hostedVideo.provider)
      .with(VIDEO_PROVIDERS.BUNNY, async () => {
        const bunnyVideo = await this.tenantDbRunnerService.runWithTenant(
          hostedVideo.tenantId,
          () => this.bunnyStreamService.getVideo(providerVideoId),
        );
        await this.recordBunnyStatus(hostedVideo, Number(bunnyVideo.status));
      })
      .otherwise(() => undefined);
  }

  private toVideoProcessingStatus(status: HostedVideoStatus): VideoProcessingStatus | undefined {
    return match(status)
      .with(
        HOSTED_VIDEO_STATUSES.UPLOADING,
        HOSTED_VIDEO_STATUSES.PROCESSING,
        () => VIDEO_PROCESSING_STATUSES.PROCESSING,
      )
      .with(HOSTED_VIDEO_STATUSES.FAILED, () => VIDEO_PROCESSING_STATUSES.FAILED)
      .with(HOSTED_VIDEO_STATUSES.READY, () => undefined)
      .exhaustive();
  }

  private hasExceededProcessingTimeout(hostedVideo: HostedVideo): boolean {
    return (
      Date.now() - new Date(hostedVideo.statusChangedAt).getTime() >
      HOSTED_VIDEO_PROCESSING_TIMEOUT_MS
    );
  }
}
