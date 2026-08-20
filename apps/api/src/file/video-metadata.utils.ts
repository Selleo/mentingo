import {
  BUNNY_VIDEO_READY_STATUSES,
  VIDEO_METADATA_BACKOFF_DELAY_MS,
  VIDEO_METADATA_JOB_ATTEMPTS,
} from "./video-metadata.constants";

import type { ProbeOutput } from "./video-metadata.types";
import type { JobsOptions } from "bullmq";

export function isValidVideoDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isBunnyVideoReadyStatus(value: unknown): boolean {
  return BUNNY_VIDEO_READY_STATUSES.has(Number(value));
}

export function getBunnyVideoId(reference: string): string | undefined {
  return reference.startsWith("bunny-") ? reference.slice("bunny-".length) : undefined;
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
