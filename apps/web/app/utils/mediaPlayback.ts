export const MEDIA_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type MediaPlaybackRate = (typeof MEDIA_PLAYBACK_RATES)[number];

export const DEFAULT_MEDIA_PLAYBACK_RATE: MediaPlaybackRate = 1;

export const isMediaPlaybackRate = (value: number): value is MediaPlaybackRate =>
  (MEDIA_PLAYBACK_RATES as readonly number[]).includes(value);
