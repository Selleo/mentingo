export const DOCUMENT_STATUS = {
  FAILED: "failed",
  PROCESSING: "processing",
  READY: "ready",
} as const;

export type DocumentStatus = (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];
