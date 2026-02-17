export const VIDEO_EMBED_PROVIDERS = {
  SELF: "self",
  YOUTUBE: "youtube",
  VIMEO: "vimeo",
  BUNNY: "bunny",
  UNKNOWN: "unknown",
} as const;

export type VideoProvider = (typeof VIDEO_EMBED_PROVIDERS)[keyof typeof VIDEO_EMBED_PROVIDERS];
