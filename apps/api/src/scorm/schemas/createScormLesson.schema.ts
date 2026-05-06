import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const createScormLessonSchema = Type.Object({
  chapterId: UUIDSchema,
  title: Type.String(),
});

export type CreateScormLessonBody = Static<typeof createScormLessonSchema>;
