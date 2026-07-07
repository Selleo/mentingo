import type { VideoCoverageRange } from "@repo/shared";
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
  store: LessonVideoProgressStore;
};

export type LessonVideoProgressStore = {
  getSnapshot: () => LessonVideoProgressSegment[];
  publishSnapshot: (change: LessonVideoProgressSnapshotChange) => void;
  reset: (segments: LessonVideoProgressSegment[]) => void;
  subscribe: (listener: () => void) => () => void;
};
