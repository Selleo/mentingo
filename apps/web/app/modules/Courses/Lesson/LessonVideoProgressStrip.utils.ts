import { mergeVideoCoverageRanges, type VideoCoverageRange } from "@repo/shared";

import { getVideoEmbedAttrsFromElement } from "~/components/RichText/extensions/utils/video";

import type {
  LessonVideoProgressSegment,
  LessonVideoProgressSnapshotChange,
  LessonVideoProgressStore,
} from "./LessonVideoProgressStrip.types";

export const VIDEO_COMPLETION_COVERAGE_THRESHOLD = 0.9;

export const clampVideoProgress = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(1, value));
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
  const left = Math.max(0, Math.min(100, (start / durationSeconds) * 100));
  const width = Math.max(0, Math.min(100 - left, ((end - start) / durationSeconds) * 100));

  return {
    left: `${left}%`,
    width: `${width}%`,
  };
};

export const createLessonVideoProgressStore = (): LessonVideoProgressStore => {
  let segments: LessonVideoProgressSegment[] = [];
  const progressChangesByResourceId = new Map<string, LessonVideoProgressSnapshotChange>();
  const listeners = new Set<() => void>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const applyStoredProgressChanges = (nextSegments: LessonVideoProgressSegment[]) => {
    return Array.from(progressChangesByResourceId.values()).reduce(
      (currentSegments, progressChange) =>
        applyLessonVideoProgressSnapshotChange(currentSegments, progressChange),
      nextSegments,
    );
  };

  return {
    getSnapshot: () => segments,
    publishSnapshot: (change) => {
      progressChangesByResourceId.set(change.resourceEntityId, change);
      segments = applyLessonVideoProgressSnapshotChange(segments, change);
      emit();
    },
    reset: (nextSegments) => {
      segments = applyStoredProgressChanges(nextSegments);
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
