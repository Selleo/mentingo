import { match } from "ts-pattern";

import { HOSTED_VIDEO_STATUSES } from "./hosted-video.constants";
import {
  BUNNY_API_VIDEO_STATUSES,
  BUNNY_WEBHOOK_VIDEO_STATUSES,
  VIDEO_METADATA_BACKOFF_DELAY_MS,
  VIDEO_METADATA_JOB_ATTEMPTS,
} from "./video-metadata.constants";

import type { HostedVideoStatus } from "./hosted-video.types";
import type { ProbeOutput } from "./video-metadata.types";
import type { JobsOptions } from "bullmq";

export function isValidVideoDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isBunnyWebhookReadyStatus(value: unknown): boolean {
  return mapBunnyWebhookStatusToHostedVideoStatus(Number(value)) === HOSTED_VIDEO_STATUSES.READY;
}

export function isBunnyApiVideoReadyStatus(value: unknown): boolean {
  return mapBunnyApiStatusToHostedVideoStatus(Number(value)) === HOSTED_VIDEO_STATUSES.READY;
}

const BUNNY_VIDEO_REFERENCE_PREFIX = "bunny-";

/**
 * Returns undefined for webhooks about side tasks, such as generated captions, which do not
 * change whether the video can be played.
 */
export function mapBunnyWebhookStatusToHostedVideoStatus(
  bunnyStatus: number,
): HostedVideoStatus | undefined {
  return match(bunnyStatus)
    .with(
      BUNNY_WEBHOOK_VIDEO_STATUSES.FINISHED,
      BUNNY_WEBHOOK_VIDEO_STATUSES.RESOLUTION_FINISHED,
      () => HOSTED_VIDEO_STATUSES.READY,
    )
    .with(
      BUNNY_WEBHOOK_VIDEO_STATUSES.FAILED,
      BUNNY_WEBHOOK_VIDEO_STATUSES.PRESIGNED_UPLOAD_FAILED,
      () => HOSTED_VIDEO_STATUSES.FAILED,
    )
    .with(
      BUNNY_WEBHOOK_VIDEO_STATUSES.QUEUED,
      BUNNY_WEBHOOK_VIDEO_STATUSES.PROCESSING,
      BUNNY_WEBHOOK_VIDEO_STATUSES.ENCODING,
      BUNNY_WEBHOOK_VIDEO_STATUSES.PRESIGNED_UPLOAD_STARTED,
      BUNNY_WEBHOOK_VIDEO_STATUSES.PRESIGNED_UPLOAD_FINISHED,
      () => HOSTED_VIDEO_STATUSES.PROCESSING,
    )
    .otherwise(() => undefined);
}

export function mapBunnyApiStatusToHostedVideoStatus(bunnyStatus: number): HostedVideoStatus {
  return match(bunnyStatus)
    .with(BUNNY_API_VIDEO_STATUSES.FINISHED, () => HOSTED_VIDEO_STATUSES.READY)
    .with(
      BUNNY_API_VIDEO_STATUSES.ERROR,
      BUNNY_API_VIDEO_STATUSES.UPLOAD_FAILED,
      () => HOSTED_VIDEO_STATUSES.FAILED,
    )
    .otherwise(() => HOSTED_VIDEO_STATUSES.PROCESSING);
}

export function getBunnyVideoId(reference: string): string | undefined {
  return reference.startsWith(BUNNY_VIDEO_REFERENCE_PREFIX)
    ? reference.slice(BUNNY_VIDEO_REFERENCE_PREFIX.length)
    : undefined;
}

export function buildBunnyVideoReference(bunnyVideoId: string): string {
  return `${BUNNY_VIDEO_REFERENCE_PREFIX}${bunnyVideoId}`;
}

export function buildVideoMetadataJobId(
  resourceId: string,
  phase: "ready" | "watchdog",
  bunnyVideoId?: string,
): string {
  const videoSuffix = bunnyVideoId ? `-${bunnyVideoId}` : "";
  return `video-metadata-${resourceId}-${phase}${videoSuffix}`;
}

export function parseFfprobeDuration(output: string): number {
  const parsed = JSON.parse(output) as ProbeOutput;
  const durations = [
    parsed.format?.duration,
    ...(parsed.streams ?? []).map((stream) => stream.duration),
  ]
    .map(Number)
    .filter(isValidVideoDuration);
  const duration = Math.max(...durations);
  if (!isValidVideoDuration(duration)) throw new Error("ffprobe returned no valid duration");
  return duration;
}

export function buildVideoMetadataJobOptions(jobId: string, delay = 0): JobsOptions {
  return {
    jobId,
    delay,
    attempts: VIDEO_METADATA_JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: VIDEO_METADATA_BACKOFF_DELAY_MS },
    removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
    removeOnFail: { age: 30 * 24 * 60 * 60, count: 1000 },
  };
}
