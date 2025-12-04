import type { UUIDType } from "src/common";
import type { LessonResourceType } from "src/lesson/lesson.schema";
import type { LessonTypes } from "src/lesson/lesson.type";
import type { QuestionType } from "src/questions/schema/question.types";

export const ACTIVITY_LOG_ACTION_TYPES = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  ENROLL_COURSE: "enroll_course",
  UNENROLL_COURSE: "unenroll_course",
  START_COURSE: "start_course",
  COMPLETE_LESSON: "complete_lesson",
  COMPLETE_COURSE: "complete_course",
  COMPLETE_CHAPTER: "complete_chapter",
  VIEW_ANNOUNCEMENT: "view_announcement",
} as const;

export type ActivityLogActionType =
  (typeof ACTIVITY_LOG_ACTION_TYPES)[keyof typeof ACTIVITY_LOG_ACTION_TYPES];

export const ACTIVITY_LOG_RESOURCE_TYPES = {
  USER: "user",
  COURSE: "course",
  CHAPTER: "chapter",
  LESSON: "lesson",
  ANNOUNCEMENT: "announcement",
  GROUP: "group",
  SETTINGS: "settings",
  INTEGRATION: "integration",
  CATEGORY: "category",
} as const;

export type ActivityLogResourceType =
  (typeof ACTIVITY_LOG_RESOURCE_TYPES)[keyof typeof ACTIVITY_LOG_RESOURCE_TYPES];

export type ActivityLogMetadata = {
  operation: ActivityLogActionType;
  changedFields?: string[];
  before?: Record<string, string> | null;
  after?: Record<string, string> | null;
  context?: Record<string, string> | null;
};

export type ActivityLogUpdateMetadata = {
  changedFields: string[];
  before: Record<string, string>;
  after: Record<string, string>;
  context?: Record<string, string> | null;
};

export type ActivityLogCreateMetadata = {
  after: Record<string, string>;
  context?: Record<string, string> | null;
};

export type ActivityLogMetadataSchema = "create" | "update";

export type ActivityLogMetadataBySchema<TSchema extends ActivityLogMetadataSchema> =
  TSchema extends "create" ? ActivityLogCreateMetadata : ActivityLogUpdateMetadata;

export type LessonActivityLogOption = {
  id?: UUIDType;
  optionText?: string | null;
  isCorrect?: boolean;
  displayOrder?: number | null;
  matchedWord?: string | null;
  scaleAnswer?: number | null;
};

export type LessonActivityLogQuestion = {
  id?: UUIDType;
  title?: string | null;
  description?: string | null;
  solutionExplanation?: string | null;
  type?: QuestionType;
  photoS3Key?: string | null;
  displayOrder?: number | null;
  options?: LessonActivityLogOption[];
};

export type LessonActivityLogResource = {
  id?: UUIDType;
  source: string;
  type: LessonResourceType;
  isExternal: boolean;
  allowFullscreen?: boolean;
  displayOrder?: number | null;
};

export type LessonActivityLogSnapshot = {
  id: UUIDType;
  title?: string | null;
  description?: string | null;
  type: LessonTypes;
  fileS3Key?: string | null;
  fileType?: string | null;
  isExternal?: boolean;
  chapterId: UUIDType;
  displayOrder?: number | null;
  thresholdScore?: number | null;
  attemptsLimit?: number | null;
  quizCooldownInHours?: number | null;
  quizSummary?: string[];
  lessonResources?: LessonActivityLogResource[];
  questions?: LessonActivityLogQuestion[];
  aiMentor?: {
    aiMentorInstructions?: string | null;
    completionConditions?: string | null;
    name?: string | null;
    avatarReference?: string | null;
    type?: string | null;
  };
};
