import { Injectable, Logger } from "@nestjs/common";
import { VIDEO_PROVIDERS } from "@repo/shared";
import { match, P } from "ts-pattern";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  HOSTED_VIDEO_STATUSES,
  HOSTED_VIDEO_UPLOAD_STALE_AFTER_MS,
} from "./hosted-video.constants";
import { HostedVideoCopyInProgressError } from "./hosted-video.errors";
import { HostedVideoRepository } from "./hosted-video.repository";
import { buildHostedVideoCopyMarker, buildHostedVideoCopyTitle } from "./hosted-video.utils";
import { BUNNY_API_VIDEO_STATUSES } from "./video-metadata.constants";
import {
  buildBunnyVideoReference,
  mapBunnyApiStatusToHostedVideoStatus,
} from "./video-metadata.utils";

import type {
  HostedVideo,
  HostedVideoCopyIdentity,
  HostedVideoCopyRequest,
  HostedVideoSourceStream,
} from "./hosted-video.types";
import type { UUIDType } from "src/common";

/**
 * Copies a video into a tenant's streaming library at most once per source video and library.
 * The copy is registered before the provider creates the video, so retries, concurrent
 * transfers, webhooks, and status checks always find it.
 */
@Injectable()
export class HostedVideoCopyService {
  private readonly logger = new Logger(HostedVideoCopyService.name);

  constructor(
    private readonly hostedVideoRepository: HostedVideoRepository,
    private readonly bunnyStreamService: BunnyStreamService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  /** Returns the destination reference of the copy, uploading only when no usable copy exists. */
  async copyVideoToTenantLibrary(request: HostedVideoCopyRequest): Promise<string> {
    const identity = await this.buildCopyIdentity(request);
    const existingCopy = await this.hostedVideoRepository.findCopy(identity);

    return match(existingCopy)
      .with(P.nullish, () => this.uploadNewCopy(identity, request))
      .with({ status: HOSTED_VIDEO_STATUSES.FAILED }, (failedCopy) =>
        this.reuploadFailedCopy(failedCopy, request),
      )
      .otherwise((usableCopy) => this.reuseCopy(usableCopy, request));
  }

  /**
   * Settles an upload whose worker stopped: adopts the provider video it created, or fails the
   * copy so the next transfer uploads it again.
   */
  async reconcileStaleUpload(copy: HostedVideo): Promise<void> {
    const uploadAgeMs = Date.now() - new Date(copy.statusChangedAt).getTime();
    if (uploadAgeMs < HOSTED_VIDEO_UPLOAD_STALE_AFTER_MS) return;

    const providerVideoId = copy.providerVideoId ?? (await this.findCreatedProviderVideoId(copy));

    if (!providerVideoId) {
      await this.hostedVideoRepository.settleUploadingCopy(copy.id, {
        status: HOSTED_VIDEO_STATUSES.FAILED,
      });
      return;
    }

    const providerVideo = await this.tenantDbRunnerService.runWithTenant(copy.tenantId, () =>
      this.bunnyStreamService.getVideo(providerVideoId),
    );

    const status = match(Number(providerVideo.status))
      .with(BUNNY_API_VIDEO_STATUSES.CREATED, () => HOSTED_VIDEO_STATUSES.FAILED)
      .otherwise((bunnyStatus) => mapBunnyApiStatusToHostedVideoStatus(bunnyStatus));

    await this.hostedVideoRepository.settleUploadingCopy(copy.id, {
      status,
      providerVideoId,
      reference: buildBunnyVideoReference(providerVideoId),
    });
  }

  private async buildCopyIdentity(
    request: HostedVideoCopyRequest,
  ): Promise<HostedVideoCopyIdentity> {
    const providerConfigurationSignature = await this.tenantDbRunnerService.runWithTenant(
      request.targetTenantId,
      () => this.bunnyStreamService.getMediaConfigurationSignature(),
    );

    return {
      tenantId: request.targetTenantId,
      provider: VIDEO_PROVIDERS.BUNNY,
      providerConfigurationSignature,
      copiedFromTenantId: request.sourceTenantId,
      copiedFromReference: request.sourceReference,
    };
  }

  private async uploadNewCopy(identity: HostedVideoCopyIdentity, request: HostedVideoCopyRequest) {
    const claimedCopy = await this.hostedVideoRepository.insertUploadingCopyIfMissing(identity);
    if (!claimedCopy) throw new HostedVideoCopyInProgressError(request.sourceReference);

    return this.uploadClaimedCopy(claimedCopy, request);
  }

  private async reuploadFailedCopy(failedCopy: HostedVideo, request: HostedVideoCopyRequest) {
    const reclaimed = await this.hostedVideoRepository.reclaimFailedCopy(failedCopy.id);
    if (!reclaimed) throw new HostedVideoCopyInProgressError(request.sourceReference);

    if (reclaimed.detachedProviderVideoId) {
      await this.deleteProviderVideo(request.targetTenantId, reclaimed.detachedProviderVideoId);
    }

    return this.uploadClaimedCopy(reclaimed.copy, request);
  }

  private reuseCopy(copy: HostedVideo, request: HostedVideoCopyRequest): string {
    if (!copy.reference) throw new HostedVideoCopyInProgressError(request.sourceReference);

    return copy.reference;
  }

  private async uploadClaimedCopy(copy: HostedVideo, request: HostedVideoCopyRequest) {
    const providerVideoId = await this.createProviderVideo(copy, request);
    const reference = buildBunnyVideoReference(providerVideoId);
    await this.hostedVideoRepository.recordCreatedVideo(copy.id, providerVideoId, reference);

    let sourceVideo: HostedVideoSourceStream | undefined;

    try {
      sourceVideo = await request.openSourceVideo();

      const { stream, contentType } = sourceVideo;

      await this.tenantDbRunnerService.runWithTenant(request.targetTenantId, () =>
        this.bunnyStreamService.uploadVideoContent({
          videoId: providerVideoId,
          stream,
          contentType,
        }),
      );
    } catch (error) {
      await this.hostedVideoRepository.updateStatus(copy.id, HOSTED_VIDEO_STATUSES.FAILED);
      await this.deleteProviderVideo(request.targetTenantId, providerVideoId);
      throw error;
    } finally {
      sourceVideo?.stream.destroy();
    }

    await this.hostedVideoRepository.updateStatus(copy.id, HOSTED_VIDEO_STATUSES.PROCESSING);
    return reference;
  }

  /**
   * Creates the copy's provider video. When the create response is lost, the video is looked up
   * by its title marker instead of being created a second time.
   */
  private async createProviderVideo(
    copy: HostedVideo,
    request: HostedVideoCopyRequest,
  ): Promise<string> {
    try {
      const { guid } = await this.tenantDbRunnerService.runWithTenant(request.targetTenantId, () =>
        this.bunnyStreamService.createVideo(buildHostedVideoCopyTitle(request.title, copy.id)),
      );
      return guid;
    } catch (error) {
      // A failed lookup leaves the copy uploading, so the stale-upload check can look again.
      const createdProviderVideoId = await this.findCreatedProviderVideoId(copy);
      if (createdProviderVideoId) return createdProviderVideoId;

      await this.hostedVideoRepository.updateStatus(copy.id, HOSTED_VIDEO_STATUSES.FAILED);
      throw error;
    }
  }

  private async findCreatedProviderVideoId(copy: HostedVideo): Promise<string | undefined> {
    const marker = buildHostedVideoCopyMarker(copy.id);
    const providerVideos = await this.tenantDbRunnerService.runWithTenant(copy.tenantId, () =>
      this.bunnyStreamService.findVideosByTitle(marker),
    );

    return providerVideos.find(({ title }) => title?.endsWith(marker))?.guid;
  }

  private async deleteProviderVideo(tenantId: UUIDType, providerVideoId: string) {
    await this.tenantDbRunnerService
      .runWithTenant(tenantId, () => this.bunnyStreamService.delete(providerVideoId))
      .catch(() => this.logger.warn(`Could not delete provider video ${providerVideoId}`));
  }
}
