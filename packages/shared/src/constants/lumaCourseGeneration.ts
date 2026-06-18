import type {
  LumaAssetRequestedEvent,
  LumaChapterGeneratedEvent,
  LumaCourseGeneratedEvent,
  LumaCourseGenerationStreamEvent as SdkLumaCourseGenerationStreamEvent,
  LumaLessonGeneratedEvent,
} from "@japro/luma-sdk";

export const COURSE_GENERATION_SYNC_SOCKET_EVENT = "luma-course-generation:sync-status-changed";

export const COURSE_GENERATION_SYNC_STATUS = {
  NOT_STARTED: "not_started",
  PROCESSING: "processing",
  FAILED: "failed",
  PROCESSED: "processed",
  DISMISSED: "dismissed",
} as const;

export type CourseGenerationSyncStatus =
  (typeof COURSE_GENERATION_SYNC_STATUS)[keyof typeof COURSE_GENERATION_SYNC_STATUS];

export const COURSE_GENERATION_MESSAGE_KEY = {
  PLANNING_NEXT_STEP: "PLANNING_NEXT_STEP",
  USING_TOOLS: "USING_TOOLS",
  SUMMARIZING_CONTEXT: "SUMMARIZING_CONTEXT",
  ANALYZING_OBJECTIVES: "ANALYZING_OBJECTIVES",
  SCANNING_LEARNING_EVIDENCE: "SCANNING_LEARNING_EVIDENCE",
  RUNNING_CURRICULUM_DESIGN: "RUNNING_CURRICULUM_DESIGN",
  INITIALIZING_CURRICULUM_PLAN: "INITIALIZING_CURRICULUM_PLAN",
  DESIGNING_CHAPTERS: "DESIGNING_CHAPTERS",
  DESIGNING_LESSON_BLUEPRINTS: "DESIGNING_LESSON_BLUEPRINTS",
  FINALIZING_COURSE_STRUCTURE: "FINALIZING_COURSE_STRUCTURE",
  PREPARING_FINAL_COURSE_SHELL: "PREPARING_FINAL_COURSE_SHELL",
  FINALIZING_LESSON_PAYLOADS: "FINALIZING_LESSON_PAYLOADS",
  COURSE_FINISHED: "COURSE_FINISHED",
  WRITING_RESPONSE: "WRITING_RESPONSE",
  WAITING_FOR_CONFIRMATION: "WAITING_FOR_CONFIRMATION",
  THINKING: "THINKING",
} as const;

export type CourseGenerationMessageKey =
  (typeof COURSE_GENERATION_MESSAGE_KEY)[keyof typeof COURSE_GENERATION_MESSAGE_KEY];

export const COURSE_GENERATION_STREAM_EVENT_TYPE = {
  COURSE_GENERATED: "course.generated",
  DESIGNER_CHAPTER_GENERATED: "designer.chapter.generated",
  ARCHITECT_LESSON_GENERATED: "architect.lesson.generated",
  ASSET_REQUESTED: "asset.requested",
} as const;

export type CourseGenerationStreamEventType =
  (typeof COURSE_GENERATION_STREAM_EVENT_TYPE)[keyof typeof COURSE_GENERATION_STREAM_EVENT_TYPE];

export type CourseGenerationMessageKeyEvent = {
  message_key: CourseGenerationMessageKey;
};

export type CourseGenerationCourseGeneratedFlagEvent = {
  course_generated: true;
};

export type CourseGenerationCourseGeneratedEvent = LumaCourseGeneratedEvent;

export type CourseGenerationChapterGeneratedEvent = LumaChapterGeneratedEvent;

export type CourseGenerationLessonGeneratedEvent = LumaLessonGeneratedEvent;

export type CourseGenerationAssetRequestedEvent = LumaAssetRequestedEvent;

export type CourseGenerationStreamEvent =
  | CourseGenerationMessageKeyEvent
  | CourseGenerationCourseGeneratedFlagEvent
  | SdkLumaCourseGenerationStreamEvent;
