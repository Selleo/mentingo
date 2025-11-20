import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { lessonForChapterSchema, lessonSchema } from "src/lesson/lesson.schema";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

export const chapterSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  lessonCount: Type.Number(),
  lessons: Type.Optional(Type.Array(lessonSchema)),
  completedLessonCount: Type.Optional(Type.Number()),
  chapterProgress: Type.Optional(Type.Union([Type.Enum(PROGRESS_STATUSES)])),
  isFreemium: Type.Optional(Type.Boolean()),
  enrolled: Type.Optional(Type.Boolean()),
  isSubmitted: Type.Optional(Type.Boolean()),
  createdAt: Type.Optional(Type.String()),
  updatedAt: Type.Optional(Type.String()),
  quizCount: Type.Optional(Type.Number()),
  displayOrder: Type.Number(),
});

export const createChapterSchema = Type.Intersect([
  Type.Omit(chapterSchema, ["id", "lessonCount", "completedLessonCount", "displayOrder"]),
  Type.Object({
    courseId: UUIDSchema,
  }),
]);

export const updateChapterSchema = Type.Intersect([
  Type.Partial(createChapterSchema),
  Type.Object({ language: supportedLanguagesSchema }),
]);

export const chapter = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  isFreemium: Type.Boolean(),
});

export const allChapterSchema = Type.Array(chapterSchema);

export const showChapterSchema = Type.Object({
  ...chapterSchema.properties,
  quizCount: Type.Optional(Type.Number()),
  lessons: lessonForChapterSchema,
});

export type Chapter = Static<typeof chapter>;
export type ChapterResponse = Static<typeof chapterSchema>;
export type ShowChapterResponse = Static<typeof showChapterSchema>;
export type AllChaptersResponse = Static<typeof allChapterSchema>;
export type CreateChapterBody = Static<typeof createChapterSchema>;
export type UpdateChapterBody = Static<typeof updateChapterSchema>;
