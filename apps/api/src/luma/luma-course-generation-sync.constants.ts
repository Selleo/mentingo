export const LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS = {
  PROCESSED: "adminCourseView.toast.lumaCourseGenerationSyncProcessed",
  PROCESSED_WITH_ASSET_WARNINGS:
    "adminCourseView.toast.lumaCourseGenerationSyncProcessedWithAssetWarnings",
  FAILED: "adminCourseView.toast.lumaCourseGenerationSyncFailed",
  DISMISSED: "adminCourseView.toast.lumaCourseGenerationSyncDismissed",
  IMPORT_NOT_IMPLEMENTED: "adminCourseView.toast.lumaCourseGenerationImportNotImplemented",
} as const;

export const LUMA_GENERATED_COURSE_LESSON_TYPES = {
  AI_MENTOR: "AI_MENTOR",
  CONTENT: "CONTENT",
  QUIZ: "QUIZ",
} as const;

export const LUMA_GENERATED_COURSE_AI_MENTOR_TYPES = {
  ROLEPLAY: "ROLEPLAY",
  MENTOR: "MENTOR",
  TEACHER: "TEACHER",
} as const;

export const LUMA_GENERATED_COURSE_QUESTION_TYPES = {
  SINGLE_SELECT: "SingleSelect",
  MULTI_SELECT: "MultiSelect",
  TRUE_OR_FALSE: "TrueOrFalse",
  BRIEF_RESPONSE: "BriefResponse",
  DETAILED_RESPONSE: "DetailedResponse",
  FILL_IN_THE_BLANKS: "FillInTheBlanks",
  GAP_FILL: "GapFill",
} as const;
