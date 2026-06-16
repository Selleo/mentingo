import type { SupportedLanguages, VideoCoverageRange } from "@repo/shared";

export type { VideoCoverageRange };

export type VideoCoverageTrackingOptions = {
  enabled: boolean;
  lessonId?: string;
  resourceEntityId?: string | null;
  language?: SupportedLanguages;
  initialCoveragePercent?: number;
  initialWatchedRanges?: VideoCoverageRange[];
  initialIsWatched?: boolean;
  initialDurationSeconds?: number | null;
  initialBucketSizeSeconds?: number | null;
  flushIntervalMs?: number;
};

export type VideoCoverageSnapshot = {
  coveragePercent: number;
  watchedRanges: VideoCoverageRange[];
  isWatched: boolean;
  durationSeconds: number | null;
  bucketSizeSeconds: number;
};
