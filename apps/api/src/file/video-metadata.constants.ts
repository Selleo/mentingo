export const FFPROBE_TIMEOUT_MS = 60_000;
export const FFPROBE_OUTPUT_LIMIT = 256 * 1024;

export const BUNNY_VIDEO_READY_STATUSES: ReadonlySet<number> = new Set([3, 4]);

export const VIDEO_METADATA_READY_JOB = "video-metadata-ready";
export const VIDEO_METADATA_WATCHDOG_JOB = "video-metadata-watchdog";
export const VIDEO_METADATA_WATCHDOG_DELAY_MS = 5 * 60 * 1000;
export const VIDEO_METADATA_JOB_ATTEMPTS = 10;
export const VIDEO_METADATA_BACKOFF_DELAY_MS = 30 * 1000;
