export const VIDEO_ENDED_SOURCE = {
  MEDIA_ENDED: "media-ended",
  AUTOPLAY_ACTION: "autoplay-action",
  GO_NEXT_LESSON: "go-next-lesson",
} as const;

export type VideoEndedEvent = {
  source: (typeof VIDEO_ENDED_SOURCE)[keyof typeof VIDEO_ENDED_SOURCE];
};

export type VideoEndedHandler = (event: VideoEndedEvent) => void;

export type VideoPlayerProps = {
  url: string | null;
  onVideoEnded?: VideoEndedHandler;
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
