export const VIDEO_AUTOPLAY = {
  AUTOPLAY: "autoplay",
  AUTOPLAY_WITH_PLAY_NEXT: "autoplay_with_play_next",
  PLAY_NEXT: "play_next",
  NO_AUTOPLAY: "no_autoplay",
} as const;

export type VideoAutoplay = (typeof VIDEO_AUTOPLAY)[keyof typeof VIDEO_AUTOPLAY];
