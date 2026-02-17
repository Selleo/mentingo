import { VIDEO_AUTOPLAY, type VideoAutoplay } from "@repo/shared";

import { ENDED_AUTOPLAY_DECISION } from "./VideoPlayer.types";

import type { EndedAutoplayDecision } from "./VideoPlayer.types";

export const isPlayNextAction = (action: VideoAutoplay) =>
  [VIDEO_AUTOPLAY.PLAY_NEXT, VIDEO_AUTOPLAY.AUTOPLAY_WITH_PLAY_NEXT].includes(
    action as typeof VIDEO_AUTOPLAY.PLAY_NEXT | typeof VIDEO_AUTOPLAY.AUTOPLAY_WITH_PLAY_NEXT,
  );

export const isAutoplayTriggerAction = (action: VideoAutoplay) =>
  [VIDEO_AUTOPLAY.AUTOPLAY, VIDEO_AUTOPLAY.AUTOPLAY_WITH_PLAY_NEXT].includes(
    action as typeof VIDEO_AUTOPLAY.AUTOPLAY | typeof VIDEO_AUTOPLAY.AUTOPLAY_WITH_PLAY_NEXT,
  );

export const shouldAutoTriggerVideo = (params: {
  autoplayEnabled: boolean;
  action: VideoAutoplay;
  isActive: boolean;
}) => {
  const { autoplayEnabled, action, isActive } = params;

  if (!autoplayEnabled) return false;
  if (!isAutoplayTriggerAction(action)) return false;
  if (isActive) return false;

  return true;
};

export const shouldShowPlayNextOverlay = (params: {
  autoplayEnabled: boolean;
  action: VideoAutoplay;
}) => {
  const { autoplayEnabled, action } = params;
  return autoplayEnabled && isPlayNextAction(action);
};

export const shouldAutoAdvanceLessonWithoutNextVideo = (params: {
  autoplayEnabled: boolean;
  action: VideoAutoplay;
  nextVideoUrl?: string;
}) => {
  const { autoplayEnabled, action, nextVideoUrl } = params;
  return autoplayEnabled && isPlayNextAction(action) && !nextVideoUrl;
};

export const resolveEndedAutoplayDecision = (params: {
  action: VideoAutoplay;
  nextVideoUrl?: string;
}): EndedAutoplayDecision => {
  const { action, nextVideoUrl } = params;

  if (action === VIDEO_AUTOPLAY.AUTOPLAY) {
    return { type: ENDED_AUTOPLAY_DECISION.AUTOPLAY_CURRENT };
  }

  if (isPlayNextAction(action)) {
    if (nextVideoUrl) return { type: ENDED_AUTOPLAY_DECISION.PLAY_NEXT_VIDEO, url: nextVideoUrl };
    return { type: ENDED_AUTOPLAY_DECISION.GO_NEXT_LESSON };
  }

  return { type: ENDED_AUTOPLAY_DECISION.NONE };
};

export const getNextVideoUrl = (params: {
  videos?: string[];
  currentUrl?: string | null;
  index?: number | null;
}) => {
  const { videos, currentUrl, index } = params;
  if (!videos?.length) return undefined;

  if (currentUrl) {
    const currentIndexByUrl = videos.findIndex((videoUrl) => videoUrl === currentUrl);
    if (currentIndexByUrl >= 0) {
      return videos[currentIndexByUrl + 1];
    }
  }

  const currentIndexByOrder = index ?? 0;
  return videos[currentIndexByOrder + 1];
};
