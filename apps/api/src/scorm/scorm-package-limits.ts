// Prevents pathological ZIPs from creating excessive S3 writes and manifest processing work.
export const MAX_SCORM_EXTRACTED_FILE_COUNT = 10_000;

// Allows large vendor packages while still blocking zip-bomb style payloads after decompression.
export const MAX_SCORM_TOTAL_UNCOMPRESSED_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
