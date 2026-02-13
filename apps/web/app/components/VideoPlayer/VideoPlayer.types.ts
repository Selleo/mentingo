export type VideoPlayerProps = {
  url: string | null;
  onVideoEnded?: () => void;
  isExternalUrl?: boolean;
};

export const ENDED_AUTOPLAY_DECISION = {
  NONE: "none",
  AUTOPLAY_CURRENT: "autoplay-current",
  PLAY_NEXT_VIDEO: "play-next-video",
  GO_NEXT_LESSON: "go-next-lesson",
} as const;

export type EndedAutoplayDecisionType =
  (typeof ENDED_AUTOPLAY_DECISION)[keyof typeof ENDED_AUTOPLAY_DECISION];

export type EndedAutoplayDecision =
  | { type: typeof ENDED_AUTOPLAY_DECISION.NONE }
  | { type: typeof ENDED_AUTOPLAY_DECISION.AUTOPLAY_CURRENT }
  | { type: typeof ENDED_AUTOPLAY_DECISION.PLAY_NEXT_VIDEO; url: string }
  | { type: typeof ENDED_AUTOPLAY_DECISION.GO_NEXT_LESSON };
