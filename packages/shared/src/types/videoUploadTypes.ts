export const VIDEO_UPLOAD_STATUS = {
  QUEUED: "queued",
  UPLOADED: "uploaded",
  PROCESSED: "processed",
  FAILED: "failed",
} as const;

export type VideoUploadStatus = (typeof VIDEO_UPLOAD_STATUS)[keyof typeof VIDEO_UPLOAD_STATUS];
