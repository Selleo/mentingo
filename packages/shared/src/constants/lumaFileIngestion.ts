export const LUMA_FILE_INGESTION_MAX_SIZE_MB = 10;
export const LUMA_FILE_INGESTION_MAX_SIZE_BYTES = LUMA_FILE_INGESTION_MAX_SIZE_MB * 1024 * 1024;

export const LUMA_FILE_INGESTION_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/x-markdown",
] as const;

export const LUMA_FILE_INGESTION_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".xmd",
] as const;
