export const NATIVE_ARCHIVE_FORMAT = "mentingo-package";
export const NATIVE_ARCHIVE_DOWNLOAD_FILENAME = "mentingo-package.zip";
export const NATIVE_ARCHIVE_VERSION = 1;

export const NATIVE_ARCHIVE_KIND = {
  COURSE: "course",
  LEARNING_PATH: "learning-path",
} as const;

export const NATIVE_ARCHIVE_JOB_ACTION = {
  EXPORT_COURSE: "export-course",
  EXPORT_LEARNING_PATH: "export-learning-path",
  IMPORT: "import",
} as const;

/**
 * How an export job decides the actor may read the exported content. `PRE_AUTHORIZED` is for callers
 * that checked access before enqueueing, such as integration keys whose owner lives in another tenant.
 */
export const NATIVE_ARCHIVE_EXPORT_ACCESS = {
  ACTOR_PERMISSIONS: "actor-permissions",
  PRE_AUTHORIZED: "pre-authorized",
} as const;

export const NATIVE_ARCHIVE_IMPORT_MODES = {
  /** Creates an editable copy; importing the same archive again keeps the existing course. */
  COPY: "copy",
  /** Creates a read-only shared course that importing a newer archive updates in place. */
  SYNC: "sync",
} as const;

export const NATIVE_ARCHIVE_IMPORT_ARCHIVE_ORIGINS = {
  UPLOAD: "upload",
  IMPORT_SOURCE: "import-source",
} as const;

export const NATIVE_ARCHIVE_IMPORT_OUTCOMES = {
  IMPORTED: "imported",
  FAILED: "failed",
} as const;

export const NATIVE_ARCHIVE_LIMITS = {
  MAX_ARCHIVE_BYTES: 800 * 1024 * 1024,
  MAX_UPLOAD_FILES: 1,
  ASSET_CLEANUP_BATCH_SIZE: 25,
  ASSET_METADATA_BATCH_SIZE: 25,
  ASSET_STAGING_BATCH_SIZE: 4,
  ASSET_UPLOAD_BATCH_SIZE: 6,
  /** Small parts keep export progress fine-grained and upload memory low. */
  EXPORT_UPLOAD_PART_BYTES: 8 * 1024 * 1024,
  MAX_UNCOMPRESSED_BYTES: 2 * 1024 * 1024 * 1024,
  MAX_ENTRIES: 10_000,
  MAX_JSON_BYTES: 32 * 1024 * 1024,
  MIN_PART_BYTES: 5 * 1024 * 1024,
  SESSION_TTL_MS: 24 * 60 * 60 * 1000,
} as const;

export const NATIVE_ARCHIVE_COURSE_ARRAY_FIELDS = [
  "chapters",
  "lessons",
  "questions",
  "options",
  "assessmentQuestionBlanks",
  "assessmentQuestionBlankAnswerSets",
  "assessmentQuestionDragAndDropOptions",
  "assessmentQuestionScaleOptions",
  "assessmentQuestionTrueFalseStatements",
  "questionResources",
  "assessmentQuestionOpenTextSettings",
  "assessments",
  "aiMentors",
  "aiMentorConfigurations",
  "aiMentorTeacherConfigurations",
  "aiMentorRoleplayConfigurations",
  "aiJudgeConfigurations",
  "aiJudgeCriteria",
  "aiJudgeScoreGuidance",
  "aiJudgeBlockingErrors",
  "aiMentorDocumentLinks",
  "aiMentorDocuments",
  "aiMentorDocChunks",
  "scormPackages",
  "scormScos",
  "lessonContentResources",
  "lessonResources",
  "courseResources",
] as const;

export const NATIVE_ARCHIVE_OMITTED_ROW_FIELDS = new Set([
  "tenantId",
  "createdAt",
  "updatedAt",
  "stripeProductId",
  "stripePriceId",
  "embedding",
  "authorId",
  "sourceTenantId",
  "sourceCourseId",
  "sourceLearningPathId",
  "deletedAt",
]);

/** What a running native-archive job is doing, reported to the user as it progresses. */
export const NATIVE_ARCHIVE_JOB_STAGES = {
  COLLECTING_CONTENT: "collecting-content",
  COPYING_FILES: "copying-files",
  PACKAGING: "packaging",
  DOWNLOADING: "downloading",
  VERIFYING: "verifying",
  UPLOADING_FILES: "uploading-files",
  INDEXING: "indexing",
  SAVING: "saving",
} as const;

/** The share of the overall progress bar, in percent, that each stage fills. */
export const NATIVE_ARCHIVE_JOB_STAGE_PERCENT_RANGES = {
  [NATIVE_ARCHIVE_JOB_STAGES.COLLECTING_CONTENT]: { start: 0, end: 10 },
  [NATIVE_ARCHIVE_JOB_STAGES.COPYING_FILES]: { start: 10, end: 80 },
  [NATIVE_ARCHIVE_JOB_STAGES.PACKAGING]: { start: 80, end: 100 },
  [NATIVE_ARCHIVE_JOB_STAGES.DOWNLOADING]: { start: 0, end: 15 },
  [NATIVE_ARCHIVE_JOB_STAGES.VERIFYING]: { start: 15, end: 30 },
  [NATIVE_ARCHIVE_JOB_STAGES.UPLOADING_FILES]: { start: 30, end: 70 },
  [NATIVE_ARCHIVE_JOB_STAGES.INDEXING]: { start: 70, end: 80 },
  [NATIVE_ARCHIVE_JOB_STAGES.SAVING]: { start: 80, end: 100 },
} as const;

/** Progress writes go to Redis, so updates inside a stage are spaced out. */
export const NATIVE_ARCHIVE_PROGRESS_MIN_INTERVAL_MS = 500;

export const NATIVE_ARCHIVE_JOB_STATE = {
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export const NATIVE_ARCHIVE_JOB_PAGE_SIZE = 1000;
export const NATIVE_ARCHIVE_JOB_RESULT_PRIVATE_FIELDS = new Set(["key", "filename"]);
export const NATIVE_ARCHIVE_EXPORT_TTL_MS = 24 * 60 * 60 * 1000;
export const NATIVE_ARCHIVE_EXPORT_REUSE_TTL_MS = 12 * 60 * 60 * 1000;
export const NATIVE_ARCHIVE_DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
export const NATIVE_ARCHIVE_DEFAULT_CURRENCY = "usd";
