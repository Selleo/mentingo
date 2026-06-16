import {
  bucketizeVideoCoverageTimeRange,
  countVideoCoverageRangeUnits,
  mergeVideoCoverageRanges,
} from "@repo/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { syncLessonVideoCompletionQueries, useLessonVideoProgress } from "~/api/mutations";

import type {
  VideoCoverageRange,
  VideoCoverageSnapshot,
  VideoCoverageTrackingOptions,
} from "./videoCoverage.types";
import type videojs from "video.js";

type VideoJSType = ReturnType<typeof videojs>;

const DEFAULT_BUCKET_SIZE_SECONDS = 1;
const DEFAULT_FLUSH_INTERVAL_MS = 15_000;
const MEDIA_DELTA_TOLERANCE_SECONDS = 1.5;

type FlushOptions = {
  syncCompletionQueries?: boolean;
};

const getSafeDurationSeconds = (player: VideoJSType | null, fallback: number | null) => {
  const duration = player?.duration();

  if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
    return Math.ceil(duration);
  }

  return fallback;
};

const getInitialSnapshot = ({
  initialCoveragePercent,
  initialWatchedRanges,
  initialIsWatched,
  initialDurationSeconds,
  initialBucketSizeSeconds,
}: VideoCoverageTrackingOptions): VideoCoverageSnapshot => ({
  coveragePercent: initialCoveragePercent ?? 0,
  watchedRanges: mergeVideoCoverageRanges(initialWatchedRanges ?? []),
  isWatched: Boolean(initialIsWatched),
  durationSeconds: initialDurationSeconds ?? null,
  bucketSizeSeconds: initialBucketSizeSeconds ?? DEFAULT_BUCKET_SIZE_SECONDS,
});

export const useVideoCoverageTracker = (
  player: VideoJSType | null,
  options: VideoCoverageTrackingOptions,
) => {
  const [snapshot, setSnapshot] = useState<VideoCoverageSnapshot>(() =>
    getInitialSnapshot(options),
  );
  const { mutateAsync: upsertVideoProgress } = useLessonVideoProgress();
  const optionsRef = useRef(options);
  const pendingRangesRef = useRef<VideoCoverageRange[]>([]);
  const activeWatchSecondsDeltaRef = useRef(0);
  const previousSampleRef = useRef<{ videoTime: number; wallClock: number } | null>(null);
  const snapshotDurationSecondsRef = useRef(snapshot.durationSeconds);
  const isSeekingRef = useRef(false);
  const isFlushingRef = useRef(false);
  const pendingLessonCompletionSyncRef = useRef(false);
  const completionSyncRequestedRef = useRef(false);
  const {
    resourceEntityId,
    initialCoveragePercent,
    initialDurationSeconds,
    initialIsWatched,
    initialWatchedRanges,
    initialBucketSizeSeconds,
  } = options;

  const enabled = Boolean(
    options.enabled && options.lessonId && options.resourceEntityId && player,
  );

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    snapshotDurationSecondsRef.current = snapshot.durationSeconds;
  }, [snapshot.durationSeconds]);

  useEffect(() => {
    setSnapshot(
      getInitialSnapshot({
        ...optionsRef.current,
        resourceEntityId,
        initialCoveragePercent,
        initialDurationSeconds,
        initialIsWatched,
        initialWatchedRanges,
        initialBucketSizeSeconds,
      }),
    );
    pendingRangesRef.current = [];
    activeWatchSecondsDeltaRef.current = 0;
    previousSampleRef.current = null;
    isSeekingRef.current = false;
  }, [
    resourceEntityId,
    initialCoveragePercent,
    initialDurationSeconds,
    initialIsWatched,
    initialWatchedRanges,
    initialBucketSizeSeconds,
  ]);

  const markRangeAsWatched = useCallback(
    (startSeconds: number, endSeconds: number) => {
      const bucketSizeSeconds =
        optionsRef.current.initialBucketSizeSeconds ?? DEFAULT_BUCKET_SIZE_SECONDS;
      const range = bucketizeVideoCoverageTimeRange({
        startSeconds,
        endSeconds,
        bucketSizeSeconds,
      });

      if (!range) return;

      pendingRangesRef.current = mergeVideoCoverageRanges([...pendingRangesRef.current, range]);

      setSnapshot((current) => {
        const watchedRanges = mergeVideoCoverageRanges([...current.watchedRanges, range]);
        const durationSeconds = getSafeDurationSeconds(player, current.durationSeconds);
        const coveragePercent = durationSeconds
          ? Math.min(1, countVideoCoverageRangeUnits(watchedRanges) / durationSeconds)
          : current.coveragePercent;

        return {
          ...current,
          coveragePercent,
          watchedRanges,
          durationSeconds,
        };
      });
    },
    [player],
  );

  const resetPreviousSample = useCallback(() => {
    if (!player) {
      previousSampleRef.current = null;
      return;
    }

    const currentTime = player.currentTime();
    previousSampleRef.current =
      typeof currentTime === "number" && Number.isFinite(currentTime)
        ? { videoTime: currentTime, wallClock: performance.now() }
        : null;
  }, [player]);

  const syncPendingLessonCompletion = useCallback(async () => {
    const lessonId = optionsRef.current.lessonId;

    if (!lessonId || !pendingLessonCompletionSyncRef.current) return;

    pendingLessonCompletionSyncRef.current = false;

    try {
      await syncLessonVideoCompletionQueries(lessonId);
    } catch {
      pendingLessonCompletionSyncRef.current = true;
    }
  }, []);

  const flush = useCallback(
    async (flushOptions: FlushOptions = {}) => {
      const currentOptions = optionsRef.current;
      const currentDuration = getSafeDurationSeconds(player, snapshotDurationSecondsRef.current);
      const shouldSyncCompletionAfterFlush = Boolean(flushOptions.syncCompletionQueries);

      if (
        shouldSyncCompletionAfterFlush &&
        (pendingLessonCompletionSyncRef.current || isFlushingRef.current)
      ) {
        completionSyncRequestedRef.current = true;
      }

      if (
        !currentOptions.enabled ||
        !currentOptions.lessonId ||
        !currentOptions.resourceEntityId ||
        !currentDuration ||
        pendingRangesRef.current.length === 0 ||
        isFlushingRef.current
      ) {
        if (!isFlushingRef.current && completionSyncRequestedRef.current) {
          completionSyncRequestedRef.current = false;
          await syncPendingLessonCompletion();
        }
        return;
      }

      const watchedRanges = pendingRangesRef.current;
      const activeWatchSecondsDelta = activeWatchSecondsDeltaRef.current;
      pendingRangesRef.current = [];
      activeWatchSecondsDeltaRef.current = 0;
      isFlushingRef.current = true;

      try {
        const progress = await upsertVideoProgress({
          lessonId: currentOptions.lessonId,
          resourceEntityId: currentOptions.resourceEntityId,
          durationSeconds: currentDuration,
          bucketSize: currentOptions.initialBucketSizeSeconds ?? DEFAULT_BUCKET_SIZE_SECONDS,
          watchedRanges,
          activeWatchSecondsDelta,
          language: currentOptions.language,
        });

        setSnapshot({
          coveragePercent: progress.coveragePercent,
          watchedRanges: progress.watchedRanges,
          isWatched: progress.isWatched,
          durationSeconds: progress.durationSeconds,
          bucketSizeSeconds: progress.bucketSizeSeconds,
        });

        if (progress.lessonCompleted) {
          pendingLessonCompletionSyncRef.current = true;
        }

        if (shouldSyncCompletionAfterFlush || completionSyncRequestedRef.current) {
          completionSyncRequestedRef.current = false;
          await syncPendingLessonCompletion();
        }
      } catch {
        pendingRangesRef.current = mergeVideoCoverageRanges([
          ...watchedRanges,
          ...pendingRangesRef.current,
        ]);
        activeWatchSecondsDeltaRef.current += activeWatchSecondsDelta;
      } finally {
        isFlushingRef.current = false;
      }
    },
    [player, syncPendingLessonCompletion, upsertVideoProgress],
  );

  useEffect(() => {
    if (!enabled || !player) return;

    const handleTimeUpdate = () => {
      const currentVideoTime = player.currentTime();
      const now = performance.now();

      if (typeof currentVideoTime !== "number" || !Number.isFinite(currentVideoTime)) {
        previousSampleRef.current = null;
        return;
      }

      const previousSample = previousSampleRef.current;
      previousSampleRef.current = { videoTime: currentVideoTime, wallClock: now };

      if (!previousSample || isSeekingRef.current || player.paused()) return;

      const mediaDelta = currentVideoTime - previousSample.videoTime;
      const wallDelta = (now - previousSample.wallClock) / 1000;
      const playbackRate = player.playbackRate() || 1;
      const allowedDelta = wallDelta * playbackRate + MEDIA_DELTA_TOLERANCE_SECONDS;

      if (mediaDelta > 0 && mediaDelta <= allowedDelta) {
        markRangeAsWatched(previousSample.videoTime, currentVideoTime);
        activeWatchSecondsDeltaRef.current += Math.min(mediaDelta, allowedDelta);
      }
    };

    const handlePlay = () => resetPreviousSample();
    const handlePause = () => void flush({ syncCompletionQueries: true });
    const handleSeeking = () => {
      isSeekingRef.current = true;
      previousSampleRef.current = null;
    };
    const handleSeeked = () => {
      isSeekingRef.current = false;
      resetPreviousSample();
    };
    const handleEnded = () => void flush({ syncCompletionQueries: true });
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") void flush({ syncCompletionQueries: true });
    };

    player.on("timeupdate", handleTimeUpdate);
    player.on("play", handlePlay);
    player.on("pause", handlePause);
    player.on("seeking", handleSeeking);
    player.on("seeked", handleSeeked);
    player.on("ended", handleEnded);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    resetPreviousSample();

    const flushInterval = window.setInterval(
      () => void flush(),
      options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
    );

    return () => {
      window.clearInterval(flushInterval);
      player.off("timeupdate", handleTimeUpdate);
      player.off("play", handlePlay);
      player.off("pause", handlePause);
      player.off("seeking", handleSeeking);
      player.off("seeked", handleSeeked);
      player.off("ended", handleEnded);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void flush({ syncCompletionQueries: true });
    };
  }, [enabled, flush, markRangeAsWatched, options.flushIntervalMs, player, resetPreviousSample]);

  const coveragePercentLabel = useMemo(
    () => Math.round(snapshot.coveragePercent * 100),
    [snapshot.coveragePercent],
  );

  return {
    snapshot,
    coveragePercentLabel,
    flush,
  };
};
