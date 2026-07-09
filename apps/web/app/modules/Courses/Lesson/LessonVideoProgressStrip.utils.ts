import { mergeVideoCoverageRanges, type VideoCoverageRange } from "@repo/shared";
import { clamp } from "lodash-es";
import { createStore } from "zustand/vanilla";

import { getVideoEmbedAttrsFromElement } from "~/components/RichText/extensions/utils/video";

import type {
  LessonVideoProgressSegment,
  LessonVideoProgressSnapshotChange,
  LessonVideoProgressStore,
  LessonVideoProgressStoreState,
} from "./LessonVideoProgressStrip.types";

export const VIDEO_COMPLETION_COVERAGE_THRESHOLD = 0.9;

export const clampVideoProgress = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;

  return clamp(value, 0, 1);
};

export const parseLessonVideoProgressSegments = (
  description: string | null,
): LessonVideoProgressSegment[] => {
  if (!description || typeof DOMParser === "undefined") return [];

  const doc = new DOMParser().parseFromString(description, "text/html");

  return Array.from(doc.querySelectorAll<HTMLElement>('[data-node-type="video"]'))
    .map((element, index): LessonVideoProgressSegment | null => {
      const attrs = getVideoEmbedAttrsFromElement(element);

      if (!attrs) return null;

      return {
        id: attrs.resourceEntityId ?? attrs.src ?? `video-${index}`,
        resourceEntityId: attrs.resourceEntityId,
        coveragePercent: clampVideoProgress(attrs.videoCoveragePercent),
        isWatched: attrs.videoIsWatched,
        watchedRanges: mergeVideoCoverageRanges(attrs.videoWatchedRanges),
        durationSeconds: attrs.videoDurationSeconds,
      };
    })
    .filter((segment): segment is LessonVideoProgressSegment => Boolean(segment));
};

export const applyLessonVideoProgressSnapshotChange = (
  segments: LessonVideoProgressSegment[],
  progressChange: LessonVideoProgressSnapshotChange,
) =>
  segments.map((segment) => {
    if (segment.resourceEntityId !== progressChange.resourceEntityId) return segment;

    return {
      ...segment,
      coveragePercent: clampVideoProgress(progressChange.snapshot.coveragePercent),
      isWatched: progressChange.snapshot.isWatched,
      watchedRanges: mergeVideoCoverageRanges(progressChange.snapshot.watchedRanges),
      durationSeconds: progressChange.snapshot.durationSeconds,
    };
  });

export const isLessonVideoProgressSegmentComplete = (segment: LessonVideoProgressSegment) =>
  segment.isWatched || segment.coveragePercent >= VIDEO_COMPLETION_COVERAGE_THRESHOLD;

export const getFallbackDurationSeconds = (watchedRanges: VideoCoverageRange[]) => {
  const maxEnd = watchedRanges.reduce((duration, [, end]) => Math.max(duration, end), 0);

  return maxEnd > 0 ? maxEnd : 1;
};

export const getLessonVideoProgressSegmentDurationSeconds = (
  segment: LessonVideoProgressSegment,
) =>
  segment.durationSeconds && segment.durationSeconds > 0
    ? segment.durationSeconds
    : getFallbackDurationSeconds(segment.watchedRanges);

export const getLessonVideoProgressSegmentWatchedRanges = (
  segment: LessonVideoProgressSegment,
  durationSeconds: number,
) =>
  isLessonVideoProgressSegmentComplete(segment) && segment.watchedRanges.length === 0
    ? ([[0, durationSeconds]] satisfies VideoCoverageRange[])
    : segment.watchedRanges;

export const getLessonVideoProgressRangeStyle = ({
  start,
  end,
  durationSeconds,
}: {
  start: number;
  end: number;
  durationSeconds: number;
}) => {
  const left = clamp((start / durationSeconds) * 100, 0, 100);
  const width = clamp(((end - start) / durationSeconds) * 100, 0, 100 - left);

  return {
    left: `${left}%`,
    width: `${width}%`,
  };
};

export const createLessonVideoProgressStore = (): LessonVideoProgressStore => {
  const progressChangesByResourceId = new Map<string, LessonVideoProgressSnapshotChange>();

  const applyStoredProgressChanges = (nextSegments: LessonVideoProgressSegment[]) => {
    return Array.from(progressChangesByResourceId.values()).reduce(
      (currentSegments, progressChange) =>
        applyLessonVideoProgressSnapshotChange(currentSegments, progressChange),
      nextSegments,
    );
  };

  return createStore<LessonVideoProgressStoreState>((set) => ({
    segments: [],
    publishSnapshot: (change) => {
      progressChangesByResourceId.set(change.resourceEntityId, change);
      set((state) => ({
        segments: applyLessonVideoProgressSnapshotChange(state.segments, change),
      }));
    },
    reset: (nextSegments) => {
      set({ segments: applyStoredProgressChanges(nextSegments) });
    },
  }));
};
