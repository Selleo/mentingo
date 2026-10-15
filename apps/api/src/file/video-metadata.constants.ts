export const FFPROBE_TIMEOUT_MS = 60_000;
export const FFPROBE_OUTPUT_LIMIT = 256 * 1024;

/** Status codes sent by Bunny Stream webhooks. */
export const BUNNY_WEBHOOK_VIDEO_STATUSES = {
  QUEUED: 0,
  PROCESSING: 1,
  ENCODING: 2,
  FINISHED: 3,
  RESOLUTION_FINISHED: 4,
  FAILED: 5,
  PRESIGNED_UPLOAD_STARTED: 6,
  PRESIGNED_UPLOAD_FINISHED: 7,
  PRESIGNED_UPLOAD_FAILED: 8,
  CAPTIONS_GENERATED: 9,
  TITLE_OR_DESCRIPTION_GENERATED: 10,
} as const;

/** Status codes returned by the Bunny Stream video API, numbered differently from webhooks. */
export const BUNNY_API_VIDEO_STATUSES = {
  CREATED: 0,
  UPLOADED: 1,
  PROCESSING: 2,
  TRANSCODING: 3,
  FINISHED: 4,
  ERROR: 5,
  UPLOAD_FAILED: 6,
  JIT_SEGMENTING: 7,
  JIT_PLAYLISTS_CREATED: 8,
} as const;

export const VIDEO_METADATA_READY_JOB = "video-metadata-ready";
export const VIDEO_METADATA_WATCHDOG_JOB = "video-metadata-watchdog";
export const VIDEO_METADATA_WATCHDOG_DELAY_MS = 5 * 60 * 1000;
export const VIDEO_METADATA_JOB_ATTEMPTS = 10;
export const VIDEO_METADATA_BACKOFF_DELAY_MS = 30 * 1000;
