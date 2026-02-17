import { useCallback } from "react";

import { resolveEndedAutoplayDecision } from "../autoplayFlow";
import { ENDED_AUTOPLAY_DECISION } from "../VideoPlayer.types";

import type { VideoAutoplay } from "@repo/shared";

type AutoplayCallbacks = {
  autoplayCurrentVideo: () => void;
  goToNextLesson: () => void;
  playVideoByUrl: (url: string) => void;
};

export function useAutoplayAction(currentAction: VideoAutoplay, nextVideoUrl?: string) {
  const onAutoplay = useCallback(
    ({ autoplayCurrentVideo, goToNextLesson, playVideoByUrl }: AutoplayCallbacks) => {
      const decision = resolveEndedAutoplayDecision({ action: currentAction, nextVideoUrl });

      switch (decision.type) {
        case ENDED_AUTOPLAY_DECISION.AUTOPLAY_CURRENT: {
          autoplayCurrentVideo();
          return;
        }
        case ENDED_AUTOPLAY_DECISION.PLAY_NEXT_VIDEO: {
          playVideoByUrl(decision.url);
          return;
        }
        case ENDED_AUTOPLAY_DECISION.GO_NEXT_LESSON: {
          goToNextLesson();
          return;
        }
        case ENDED_AUTOPLAY_DECISION.NONE:
        default: {
          return;
        }
      }
    },
    [currentAction, nextVideoUrl],
  );

  return { onAutoplay };
}
