import type {
  createLumaClient,
  GeneratedCourseBundleResponse,
  GeneratedCourseResponse,
} from "@japro/luma-sdk";
import type { CourseGenerationSyncStatus } from "@repo/shared";
import type { UUIDType } from "src/common";
import type {
  LUMA_GENERATED_COURSE_AI_MENTOR_TYPES,
  LUMA_GENERATED_COURSE_QUESTION_TYPES,
} from "src/luma/luma-course-generation-sync.constants";
import type { LumaCourseGenerationSyncRecord } from "src/luma/luma-course-generation-sync.repository";

export type LumaClient = ReturnType<typeof createLumaClient>;

export type LumaGeneratedCourseAiMentorType =
  (typeof LUMA_GENERATED_COURSE_AI_MENTOR_TYPES)[keyof typeof LUMA_GENERATED_COURSE_AI_MENTOR_TYPES];

export type LumaGeneratedCourseQuestionType =
  (typeof LUMA_GENERATED_COURSE_QUESTION_TYPES)[keyof typeof LUMA_GENERATED_COURSE_QUESTION_TYPES];

export type LumaGeneratedCourseChapter = GeneratedCourseResponse["chapters"][number];
export type LumaGeneratedCourseLesson = LumaGeneratedCourseChapter["lessons"][number];
export type LumaGeneratedCourseQuestion = NonNullable<
  LumaGeneratedCourseLesson["questions"]
>[number];
export type LumaGeneratedCourseQuestionOption = NonNullable<
  LumaGeneratedCourseQuestion["options"]
>[number];
export type LumaGeneratedCourseAsset = GeneratedCourseBundleResponse["assets"][number];
export type LumaGeneratedCourseLessonAsset = NonNullable<
  LumaGeneratedCourseLesson["assets"]
>[number];

export type SerializedLumaCourseGenerationSyncStatus = {
  status: CourseGenerationSyncStatus;
  draftId: LumaCourseGenerationSyncRecord["draftId"];
  attemptCount: number;
  startedAt: LumaCourseGenerationSyncRecord["startedAt"] | null;
  processedAt: LumaCourseGenerationSyncRecord["processedAt"] | null;
  failedAt: LumaCourseGenerationSyncRecord["failedAt"] | null;
  dismissedAt: LumaCourseGenerationSyncRecord["dismissedAt"] | null;
  lastError: string | null;
};

export type LumaAiMentorContextIngestion = {
  lessonId: UUIDType;
  relevantContext: string;
};

export type LumaGeneratedCourseImportStats = {
  skippedAssetCount: number;
};

export type LumaGeneratedCourseImportResult = {
  sync: LumaCourseGenerationSyncRecord;
  stats: LumaGeneratedCourseImportStats;
};
