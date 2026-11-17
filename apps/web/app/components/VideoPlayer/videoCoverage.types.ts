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
  learningStateId?: string | null;
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

export type CoverageTrackedPlayer = {
  currentTime: () => number | undefined;
  duration: () => number | undefined;
  paused: () => boolean;
  playbackRate: () => number | undefined;
  isDisposed: () => boolean;
  el: () => Element | null | undefined;
  on: (eventName: string, listener: () => void) => void;
  off: (eventName: string, listener: () => void) => void;
};

export type MediaCoverageUpsertRequest = {
  lessonId: string;
  learningStateId?: string | null;
  resourceEntityId: string;
  durationSeconds: number;
  bucketSize: number;
  watchedRanges: VideoCoverageRange[];
  activeWatchSecondsDelta: number;
  language?: SupportedLanguages;
};

export type MediaCoverageUpsertResult = {
  coveragePercent: number;
  watchedRanges: VideoCoverageRange[];
  isWatched: boolean;
  durationSeconds: number;
  bucketSizeSeconds: number;
  lessonCompleted: boolean;
};

export type UpsertMediaCoverage = (
  request: MediaCoverageUpsertRequest,
) => Promise<MediaCoverageUpsertResult>;
