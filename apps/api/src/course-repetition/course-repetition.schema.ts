import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const courseLearningStateSchema = Type.Object({
  id: UUIDSchema,
  completedAt: Type.Union([Type.String(), Type.Null()]),
  finishedChapterCount: Type.Number(),
});

export const courseRepetitionSchema = Type.Object({
  enabled: Type.Boolean(),
  current: Type.Union([courseLearningStateSchema, Type.Null()]),
  repetition: Type.Union([courseLearningStateSchema, Type.Null()]),
});

export const repeatCourseBodySchema = Type.Object({ currentStateId: UUIDSchema });
export type RepeatCourseBody = Static<typeof repeatCourseBodySchema>;
export type CourseRepetitionResponse = Static<typeof courseRepetitionSchema>;
