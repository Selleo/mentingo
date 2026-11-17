import {
  COURSE_ORIGIN_TYPES,
  COURSE_STATUSES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const integrationCourseMetadataSchema = Type.Object({
  category: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  durationMinutes: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
});

export const integrationCourseSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  description: Type.String(),
  baseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  availableLocales: Type.Array(Type.Enum(SUPPORTED_LANGUAGES)),
  thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
  status: Type.Enum(COURSE_STATUSES),
  originType: Type.Enum(COURSE_ORIGIN_TYPES),
  chapterCount: Type.Number(),
  lessonCount: Type.Number(),
  metadata: integrationCourseMetadataSchema,
  updatedAt: Type.String(),
});

export const integrationCoursesSchema = Type.Array(integrationCourseSchema);

export type IntegrationCourse = Static<typeof integrationCourseSchema>;
export type IntegrationCoursesResponse = Static<typeof integrationCoursesSchema>;

export const integrationCourseOutlineLessonSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  type: Type.Enum(LESSON_TYPES),
});

export const integrationCourseOutlineChapterSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  lessons: Type.Array(integrationCourseOutlineLessonSchema),
});

export const integrationCourseOutlineSchema = Type.Object({
  id: UUIDSchema,
  learningOutcomes: Type.Array(Type.String()),
  chapters: Type.Array(integrationCourseOutlineChapterSchema),
});

export type IntegrationCourseOutlineChapter = Static<typeof integrationCourseOutlineChapterSchema>;
export type IntegrationCourseOutline = Static<typeof integrationCourseOutlineSchema>;
