export const VIDEO_UPLOAD_STATUS = {
  QUEUED: "queued",
  UPLOADED: "uploaded",
  PROCESSED: "processed",
  FAILED: "failed",
} as const;

export type VideoUploadStatus = (typeof VIDEO_UPLOAD_STATUS)[keyof typeof VIDEO_UPLOAD_STATUS];

export const VIDEO_PROVIDERS = {
  BUNNY: "bunny",
  S3: "s3",
} as const;

export type VideoProviderType = (typeof VIDEO_PROVIDERS)[keyof typeof VIDEO_PROVIDERS];
