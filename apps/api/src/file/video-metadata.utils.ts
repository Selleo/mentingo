import { match, P } from "ts-pattern";

import { HOSTED_VIDEO_STATUSES } from "./hosted-video.constants";
import {
  BUNNY_VIDEO_FAILED_STATUSES,
  BUNNY_VIDEO_READY_STATUSES,
  VIDEO_METADATA_BACKOFF_DELAY_MS,
  VIDEO_METADATA_JOB_ATTEMPTS,
} from "./video-metadata.constants";

import type { HostedVideoStatus } from "./hosted-video.types";
import type { ProbeOutput } from "./video-metadata.types";
import type { JobsOptions } from "bullmq";

export function isValidVideoDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isBunnyVideoReadyStatus(value: unknown): boolean {
  return BUNNY_VIDEO_READY_STATUSES.has(Number(value));
}

const BUNNY_VIDEO_REFERENCE_PREFIX = "bunny-";

export function mapBunnyStatusToHostedVideoStatus(bunnyStatus: number): HostedVideoStatus {
  return match(bunnyStatus)
    .with(
      P.when((status) => BUNNY_VIDEO_READY_STATUSES.has(status)),
      () => HOSTED_VIDEO_STATUSES.READY,
    )
    .with(
      P.when((status) => BUNNY_VIDEO_FAILED_STATUSES.has(status)),
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
