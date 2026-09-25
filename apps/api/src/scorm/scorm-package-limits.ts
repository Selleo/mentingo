// Prevents pathological ZIPs from creating excessive S3 writes and manifest processing work.
export const MAX_SCORM_EXTRACTED_FILE_COUNT = 10_000;

export const MAX_SCORM_PACKAGE_SIZE_BYTES = 500 * 1024 * 1024;

export const SCORM_PACKAGE_MIME_TYPES = {
  ZIP: "application/zip",
  WINDOWS_ZIP: "application/x-zip-compressed",
} as const;

// Allows large vendor packages while still blocking zip-bomb style payloads after decompression.
export const MAX_SCORM_TOTAL_UNCOMPRESSED_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
