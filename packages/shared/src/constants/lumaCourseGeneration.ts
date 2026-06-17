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

export type CourseGenerationCourseGeneratedEvent = {
  type: (typeof COURSE_GENERATION_STREAM_EVENT_TYPE)["COURSE_GENERATED"];
  draftId: string;
};

export type CourseGenerationChapterGeneratedEvent = {
  type: (typeof COURSE_GENERATION_STREAM_EVENT_TYPE)["DESIGNER_CHAPTER_GENERATED"];
  generation: {
    chapter_index: number;
    title: string;
    target_lesson_count: number;
  };
};

export type CourseGenerationLessonGeneratedEvent = {
  type: (typeof COURSE_GENERATION_STREAM_EVENT_TYPE)["ARCHITECT_LESSON_GENERATED"];
  chapter_index: number;
  lesson_index: number;
  generation: {
    lesson_type: "AI_MENTOR" | "CONTENT" | "QUIZ";
    title: string;
  };
  relevant_context: string | null;
};

export type CourseGenerationAssetRequestedEvent = {
  type: (typeof COURSE_GENERATION_STREAM_EVENT_TYPE)["ASSET_REQUESTED"];
  draftId: string;
  assetId: string;
  chapterIndex?: number;
  lessonIndex?: number;
  provider?: string;
  status?: string;
};

export type CourseGenerationStreamEvent =
  | CourseGenerationMessageKeyEvent
  | CourseGenerationCourseGeneratedFlagEvent
  | CourseGenerationCourseGeneratedEvent
  | CourseGenerationChapterGeneratedEvent
  | CourseGenerationLessonGeneratedEvent
  | CourseGenerationAssetRequestedEvent;
