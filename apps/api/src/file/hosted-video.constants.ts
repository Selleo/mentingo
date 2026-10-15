export const HOSTED_VIDEO_STATUSES = {
  UPLOADING: "uploading",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
} as const;

export const HOSTED_VIDEO_STATUS_CHECK_INTERVAL_MS = 10 * 60 * 1000;
export const HOSTED_VIDEO_PROCESSING_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const HOSTED_VIDEO_STATUS_CHECK_BATCH_SIZE = 100;
export const HOSTED_VIDEO_UPLOAD_STALE_AFTER_MS = 30 * 60 * 1000;
export const HOSTED_VIDEO_COPY_TITLE_MARKER = "copy";
