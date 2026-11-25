export const BUNNY_CDN_TOKEN_EXPIRY = 3_500; // just under 1 hour in seconds (buffer for clock skew)

export const VIDEO_MP4_UNAVAILABLE_REASONS = {
  STILL_PROCESSING: "still-processing",
  ENCODING_FAILED: "encoding-failed",
  NOT_GENERATED: "not-generated",
} as const;
