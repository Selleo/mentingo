export const S3_OPERATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Parts of one streamed upload sent at the same time. The stream keeps being read while they
 * upload, so memory peaks at about this many parts.
 */
export const S3_MULTIPART_UPLOAD_CONCURRENCY = 3;
