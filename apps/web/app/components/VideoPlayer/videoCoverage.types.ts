import type { SupportedLanguages, VideoCoverageRange } from "@repo/shared";

export type { VideoCoverageRange };

export type VideoCoverageSnapshot = {
  coveragePercent: number;
  watchedRanges: VideoCoverageRange[];
  isWatched: boolean;
  durationSeconds: number | null;
  bucketSizeSeconds: number;
};

export type VideoCoverageSnapshotChange = {
  resourceEntityId: string;
  snapshot: VideoCoverageSnapshot;
};

export type VideoCoverageTrackingOptions = {
  enabled: boolean;
  showCoverageMarkers?: boolean;
  lessonId?: string;
  resourceEntityId?: string | null;
  language?: SupportedLanguages;
  initialCoveragePercent?: number;
  initialWatchedRanges?: VideoCoverageRange[];
  initialIsWatched?: boolean;
  initialDurationSeconds?: number | null;
  initialBucketSizeSeconds?: number | null;
  flushIntervalMs?: number;
  onSnapshotChange?: (change: VideoCoverageSnapshotChange) => void;
  onVideoActivated?: (resourceEntityId: string) => void;
};
