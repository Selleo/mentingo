import { Injectable } from "@nestjs/common";
import { VIDEO_PROVIDERS } from "@repo/shared";

import { QUEUE_NAMES, QueueService } from "src/queue";

import {
  VIDEO_METADATA_READY_JOB,
  VIDEO_METADATA_WATCHDOG_DELAY_MS,
  VIDEO_METADATA_WATCHDOG_JOB,
} from "./video-metadata.constants";
import { buildVideoMetadataJobId, buildVideoMetadataJobOptions } from "./video-metadata.utils";

import type { VideoMetadataEnqueueParams } from "./video-metadata.types";
import type { Job } from "bullmq";
import type { VideoMetadataJobData } from "src/queue/queue.types";

@Injectable()
export class VideoMetadataQueueService {
  constructor(private readonly queueService: QueueService) {}

  enqueueReady(params: VideoMetadataEnqueueParams): Promise<Job<VideoMetadataJobData>> {
    return this.enqueue(
      VIDEO_METADATA_READY_JOB,
      params,
      buildVideoMetadataJobId(
        params.resourceId,
        "ready",
        params.provider === VIDEO_PROVIDERS.BUNNY ? params.bunnyVideoId : undefined,
      ),
    );
  }

  enqueueWatchdog(params: VideoMetadataEnqueueParams): Promise<Job<VideoMetadataJobData>> {
    return this.enqueue(
      VIDEO_METADATA_WATCHDOG_JOB,
      params,
      buildVideoMetadataJobId(
        params.resourceId,
        "watchdog",
        params.provider === VIDEO_PROVIDERS.BUNNY ? params.bunnyVideoId : undefined,
      ),
      VIDEO_METADATA_WATCHDOG_DELAY_MS,
    );
  }

  private enqueue(
    name: string,
    data: VideoMetadataJobData,
    jobId: string,
    delay = 0,
  ): Promise<Job<VideoMetadataJobData>> {
    return this.queueService.enqueue(
      QUEUE_NAMES.VIDEO_METADATA,
      name,
      data,
      buildVideoMetadataJobOptions(jobId, delay),
    );
  }
}
