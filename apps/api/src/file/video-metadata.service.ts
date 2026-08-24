import { spawn } from "node:child_process";

import { Injectable, Logger } from "@nestjs/common";
import { VIDEO_PROVIDERS } from "@repo/shared";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { ResourceVideoDurationUpdatedEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { S3Service } from "src/s3/s3.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { FFPROBE_OUTPUT_LIMIT, FFPROBE_TIMEOUT_MS } from "./video-metadata.constants";
import { VideoMetadataRepository } from "./video-metadata.repository";
import { VideoMetadataRetryableError } from "./video-metadata.types";
import {
  getBunnyVideoId,
  isBunnyVideoReadyStatus,
  isValidVideoDuration,
  parseFfprobeDuration,
} from "./video-metadata.utils";

import type { UUIDType } from "src/common";
import type { VideoMetadataJobData } from "src/queue/queue.types";

@Injectable()
export class VideoMetadataService {
  private readonly logger = new Logger(VideoMetadataService.name);

  constructor(
    private readonly videoMetadataRepository: VideoMetadataRepository,
    private readonly tenantRunner: TenantDbRunnerService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
  ) {}

  async process(job: VideoMetadataJobData): Promise<void> {
    const resource = await this.videoMetadataRepository.findResource(job.resourceId);

    if (!resource) {
      this.logger.warn(`Skipping video metadata job for missing resource ${job.resourceId}`);
      return;
    }

    if (isValidVideoDuration(resource.metadata?.durationSeconds)) return;

    const duration =
      job.provider === VIDEO_PROVIDERS.BUNNY
        ? await this.getBunnyDuration(job.bunnyVideoId ?? getBunnyVideoId(resource.reference))
        : await this.getS3Duration(job.fileKey ?? resource.reference);

    if (!isValidVideoDuration(duration)) {
      throw new VideoMetadataRetryableError(
        `Video provider returned an invalid duration for resource ${job.resourceId}`,
      );
    }

    await this.persistDuration(job.resourceId, Math.ceil(duration));
  }

  private async getS3Duration(fileKey: string): Promise<number> {
    if (!fileKey || fileKey.startsWith("bunny-")) {
      throw new Error("S3 video metadata job is missing an S3 file key");
    }

    const signedUrl = await this.s3Service.getSignedUrl(fileKey, 5 * 60);
    return this.runFfprobe(signedUrl);
  }

  private async getBunnyDuration(videoId?: string): Promise<number> {
    if (!videoId) throw new Error("Bunny video metadata job is missing a video ID");

    const video = await this.bunnyStreamService.getVideo(videoId);
    if (!isBunnyVideoReadyStatus(video.status) || !isValidVideoDuration(Number(video.length))) {
      throw new VideoMetadataRetryableError(`Bunny video ${videoId} is not ready`);
    }

    return Number(video.length);
  }

  private async persistDuration(resourceId: UUIDType, durationSeconds: number) {
    await this.tenantRunner.transactionWithHandle(async (trx) => {
      const current = await this.videoMetadataRepository.findResource(resourceId, trx);

      if (!current || isValidVideoDuration(current.metadata?.durationSeconds)) return;

      await this.videoMetadataRepository.updateDurationSeconds(resourceId, durationSeconds, trx);

      await this.outboxPublisher.publish(
        new ResourceVideoDurationUpdatedEvent({ resourceId }),
        trx,
      );
    });
  }

  private runFfprobe(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration:stream=duration", "-of", "json", url],
        { shell: false, windowsHide: true },
      );
      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
      };
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        finish(() => reject(new VideoMetadataRetryableError("ffprobe timed out")));
      }, FFPROBE_TIMEOUT_MS);

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
        if (Buffer.byteLength(stdout) > FFPROBE_OUTPUT_LIMIT) {
          child.kill("SIGKILL");
          finish(() => reject(new Error("ffprobe output exceeded the configured limit")));
        }
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
        if (Buffer.byteLength(stderr) > FFPROBE_OUTPUT_LIMIT)
          stderr = stderr.slice(-FFPROBE_OUTPUT_LIMIT);
      });
      child.once("error", (error) => finish(() => reject(error)));
      child.once("close", (code) => {
        if (code !== 0) {
          finish(() =>
            reject(new VideoMetadataRetryableError(`ffprobe failed: ${stderr.slice(0, 1000)}`)),
          );
          return;
        }

        try {
          finish(() => resolve(parseFfprobeDuration(stdout)));
        } catch (error) {
          finish(() => reject(error));
        }
      });
    });
  }
}
