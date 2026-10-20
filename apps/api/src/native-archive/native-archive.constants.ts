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
  MAX_ARCHIVE_BYTES: 500 * 1024 * 1024,
  MAX_UPLOAD_FILES: 1,
  ASSET_CLEANUP_BATCH_SIZE: 25,
  ASSET_METADATA_BATCH_SIZE: 25,
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

export const NATIVE_ARCHIVE_JOB_STATE = {
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export const NATIVE_ARCHIVE_JOB_PAGE_SIZE = 1000;
export const NATIVE_ARCHIVE_EXPORT_TTL_MS = 24 * 60 * 60 * 1000;
export const NATIVE_ARCHIVE_DEFAULT_CURRENCY = "usd";
