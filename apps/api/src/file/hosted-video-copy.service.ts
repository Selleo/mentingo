import { Injectable, Logger } from "@nestjs/common";
import { VIDEO_PROVIDERS } from "@repo/shared";
import { match, P } from "ts-pattern";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { HOSTED_VIDEO_STATUSES } from "./hosted-video.constants";
import { HostedVideoCopyInProgressError } from "./hosted-video.errors";
import { HostedVideoRepository } from "./hosted-video.repository";
import { buildBunnyVideoReference } from "./video-metadata.utils";

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
    const claimedCopy = await this.hostedVideoRepository.reclaimFailedCopy(failedCopy.id);
    if (!claimedCopy) throw new HostedVideoCopyInProgressError(request.sourceReference);

    if (claimedCopy.providerVideoId) {
      await this.deleteProviderVideo(request.targetTenantId, claimedCopy.providerVideoId);
    }

    return this.uploadClaimedCopy(claimedCopy, request);
  }

  private reuseCopy(copy: HostedVideo, request: HostedVideoCopyRequest): string {
    if (!copy.reference) throw new HostedVideoCopyInProgressError(request.sourceReference);

    return copy.reference;
  }

  private async uploadClaimedCopy(copy: HostedVideo, request: HostedVideoCopyRequest) {
    const { guid: providerVideoId } = await this.tenantDbRunnerService.runWithTenant(
      request.targetTenantId,
      () => this.bunnyStreamService.createVideo(request.title),
    );
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

  private async deleteProviderVideo(tenantId: UUIDType, providerVideoId: string) {
    await this.tenantDbRunnerService
      .runWithTenant(tenantId, () => this.bunnyStreamService.delete(providerVideoId))
      .catch(() => this.logger.warn(`Could not delete provider video ${providerVideoId}`));
  }
}
