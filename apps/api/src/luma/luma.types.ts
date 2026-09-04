import type {
  createLumaClient,
  GeneratedCourseBundleResponse,
  GeneratedCourseResponse,
} from "@japro/luma-sdk";
import type { CourseGenerationSyncStatus } from "@repo/shared";
import type { Static } from "@sinclair/typebox";
import type { InferUIMessageChunk, UIMessage } from "ai";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { LUMA_GENERATED_COURSE_QUESTION_TYPES } from "src/luma/luma-course-generation-sync.constants";
import type { LumaCourseGenerationSyncRecord } from "src/luma/luma-course-generation-sync.repository";
import type { chatOptionsSchema } from "src/luma/schema/luma.schema";

export type LumaClient = ReturnType<typeof createLumaClient>;

export type CourseGenerationChatBody = Static<typeof chatOptionsSchema>;

export type CourseGenerationUIMessage = UIMessage<
  unknown,
  {
    courseGenerationEvent: unknown;
  }
>;

export type CourseGenerationUIMessageChunk = InferUIMessageChunk<CourseGenerationUIMessage>;

export type CourseGenerationLegacyFramePipeOptions = {
  stream: AsyncIterable<Buffer>;
  integrationId: string;
  currentUser: CurrentUserType;
  writer: { write: (chunk: CourseGenerationUIMessageChunk) => void };
};

export type LumaGeneratedCourseQuestionType =
  (typeof LUMA_GENERATED_COURSE_QUESTION_TYPES)[keyof typeof LUMA_GENERATED_COURSE_QUESTION_TYPES];

export type LumaGeneratedCourseChapter = GeneratedCourseResponse["chapters"][number];
export type LumaGeneratedCourseLesson = LumaGeneratedCourseChapter["lessons"][number];
export type LumaGeneratedCourseAiMentor = NonNullable<LumaGeneratedCourseLesson["aiMentor"]>;
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
