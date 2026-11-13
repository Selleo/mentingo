import { useCallback, useMemo } from "react";

import { useLessonAudioProgress } from "~/api/mutations";
import { useMediaCoverageTracker } from "~/components/VideoPlayer/useVideoCoverageTracker";

import type {
  CoverageTrackedPlayer,
  MediaCoverageUpsertRequest,
  VideoCoverageTrackingOptions,
} from "~/components/VideoPlayer/videoCoverage.types";

const createAudioCoverageTrackedPlayer = (audio: HTMLAudioElement): CoverageTrackedPlayer => ({
  currentTime: () => audio.currentTime,
  duration: () => audio.duration,
  paused: () => audio.paused,
  playbackRate: () => audio.playbackRate,
  isDisposed: () => false,
  el: () => audio,
  on: (eventName, listener) => audio.addEventListener(eventName, listener),
  off: (eventName, listener) => audio.removeEventListener(eventName, listener),
});

export const useAudioCoverageTracker = (
  audio: HTMLAudioElement | null,
  options: VideoCoverageTrackingOptions,
) => {
  const { mutateAsync: upsertAudioProgress } = useLessonAudioProgress();

  const player = useMemo(() => (audio ? createAudioCoverageTrackedPlayer(audio) : null), [audio]);

  const upsertListenedCoverage = useCallback(
    async ({ watchedRanges, activeWatchSecondsDelta, ...request }: MediaCoverageUpsertRequest) => {
      const progress = await upsertAudioProgress({
        ...request,
        listenedRanges: watchedRanges,
        activeListenSecondsDelta: activeWatchSecondsDelta,
      });

      return {
        ...progress,
        watchedRanges: progress.listenedRanges,
        isWatched: progress.isListened,
      };
    },
    [upsertAudioProgress],
  );

  return useMediaCoverageTracker(player, options, upsertListenedCoverage);
};
