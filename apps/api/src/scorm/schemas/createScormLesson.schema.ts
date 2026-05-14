import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const createScormLessonSchema = Type.Object({
  chapterId: UUIDSchema,
  title: Type.String(),
  language: supportedLanguagesSchema,
});

export type CreateScormLessonBody = Static<typeof createScormLessonSchema>;

export const attachScormLessonPackageSchema = Type.Object({
  title: Type.String(),
  language: supportedLanguagesSchema,
});

export type AttachScormLessonPackageBody = Static<typeof attachScormLessonPackageSchema>;
