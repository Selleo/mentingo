import type { VideoCoverageRange } from "@repo/shared";
import type { StoreApi } from "zustand/vanilla";
import type { VideoCoverageSnapshot } from "~/components/VideoPlayer/videoCoverage.types";

export type LessonVideoProgressSnapshotChange = {
  resourceEntityId: string;
  snapshot: VideoCoverageSnapshot;
};

export type LessonVideoProgressSegment = {
  id: string;
  resourceEntityId: string | null;
  coveragePercent: number;
  isWatched: boolean;
  watchedRanges: VideoCoverageRange[];
  durationSeconds: number | null;
};

export type LessonVideoProgressStripProps = {
  lessonId: string;
  description: string | null;
  enabled: boolean;
  showRequirementWarning?: boolean;
  store: LessonVideoProgressStore;
};

export type LessonVideoProgressStoreState = {
  segments: LessonVideoProgressSegment[];
  lastActiveResourceEntityId: string | null;
  publishSnapshot: (change: LessonVideoProgressSnapshotChange) => void;
  markVideoActivated: (resourceEntityId: string) => void;
  reset: (segments: LessonVideoProgressSegment[]) => void;
};

export type LessonVideoProgressStore = StoreApi<LessonVideoProgressStoreState>;
