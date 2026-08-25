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
import type { VideoCoverageSnapshot } from "~/components/VideoPlayer/videoCoverage.types";

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

    const watchedRanges = mergeVideoCoverageRanges([
      ...segment.watchedRanges,
      ...progressChange.snapshot.watchedRanges,
    ]);

    return {
      ...segment,
      coveragePercent: Math.max(
        clampVideoProgress(segment.coveragePercent),
        clampVideoProgress(progressChange.snapshot.coveragePercent),
      ),
      isWatched: segment.isWatched || progressChange.snapshot.isWatched,
      watchedRanges,
      durationSeconds: progressChange.snapshot.durationSeconds ?? segment.durationSeconds,
    };
  });

export const isLessonVideoProgressSegmentComplete = (segment: LessonVideoProgressSegment) =>
  segment.isWatched || segment.coveragePercent >= VIDEO_COMPLETION_COVERAGE_THRESHOLD;

export const hasStartedLessonVideo = (segment: LessonVideoProgressSegment) =>
  segment.coveragePercent > 0 || segment.watchedRanges.length > 0;

export const getLessonVideoResumeTarget = (
  segments: LessonVideoProgressSegment[],
  lastActiveResourceEntityId: string | null,
) => {
  const incomplete = segments.filter((segment) => !isLessonVideoProgressSegmentComplete(segment));
  const lastActive = incomplete.find(
    (segment) => segment.resourceEntityId === lastActiveResourceEntityId,
  );
  if (lastActive?.resourceEntityId) return lastActive.resourceEntityId;

  const started = incomplete.find(hasStartedLessonVideo);
  if (started?.resourceEntityId) return started.resourceEntityId;

  return incomplete.find((segment) => segment.resourceEntityId)?.resourceEntityId ?? null;
};

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

  const mergeSnapshotChange = (
    previous: LessonVideoProgressSnapshotChange | undefined,
    next: LessonVideoProgressSnapshotChange,
  ): LessonVideoProgressSnapshotChange => {
    if (!previous) return next;

    const snapshot: VideoCoverageSnapshot = {
      ...next.snapshot,
      coveragePercent: Math.max(
        clampVideoProgress(previous.snapshot.coveragePercent),
        clampVideoProgress(next.snapshot.coveragePercent),
      ),
      isWatched: previous.snapshot.isWatched || next.snapshot.isWatched,
      watchedRanges: mergeVideoCoverageRanges([
        ...previous.snapshot.watchedRanges,
        ...next.snapshot.watchedRanges,
      ]),
      durationSeconds: next.snapshot.durationSeconds ?? previous.snapshot.durationSeconds,
    };

    return { ...next, snapshot };
  };

  const applyStoredProgressChanges = (nextSegments: LessonVideoProgressSegment[]) => {
    return Array.from(progressChangesByResourceId.values()).reduce(
      (currentSegments, progressChange) =>
        applyLessonVideoProgressSnapshotChange(currentSegments, progressChange),
      nextSegments,
    );
  };

  return createStore<LessonVideoProgressStoreState>((set) => ({
    segments: [],
    lastActiveResourceEntityId: null,
    publishSnapshot: (change) => {
      const mergedChange = mergeSnapshotChange(
        progressChangesByResourceId.get(change.resourceEntityId),
        change,
      );
      progressChangesByResourceId.set(change.resourceEntityId, mergedChange);
      set((state) => ({
        segments: applyLessonVideoProgressSnapshotChange(state.segments, mergedChange),
      }));
    },
    markVideoActivated: (resourceEntityId) => set({ lastActiveResourceEntityId: resourceEntityId }),
    reset: (nextSegments) => {
      set({ segments: applyStoredProgressChanges(nextSegments) });
    },
  }));
};
