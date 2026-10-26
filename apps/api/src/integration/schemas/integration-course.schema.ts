import { COURSE_ORIGIN_TYPES, COURSE_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
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
