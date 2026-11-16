import { SCORM_EXPORT_LESSON_TYPES } from "@repo/scorm-export-generator";

export const SCORM_EXPORTABLE_LESSON_TYPES = new Set<string>(SCORM_EXPORT_LESSON_TYPES);

export const SCORM_EXPORT_FORMAT = "scorm-1-2";

export const SCORM_EXPORT_FILENAME_SUFFIX = "scorm-12";

export const SCORM_EXPORT_FALLBACK_FILENAME_SLUG = "course";

export const SCORM_EXPORT_FILE_STAGING_BATCH_SIZE = 8;
