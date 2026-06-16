import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const lessonVideoProgressRangeSchema = Type.Tuple([
  Type.Number({ minimum: 0 }),
  Type.Number({ minimum: 0 }),
]);

export const upsertLessonVideoProgressSchema = Type.Object({
  lessonId: UUIDSchema,
  resourceEntityId: UUIDSchema,
  durationSeconds: Type.Number({ minimum: 1 }),
  bucketSize: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  watchedRanges: Type.Array(lessonVideoProgressRangeSchema),
  activeWatchSecondsDelta: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
  language: Type.Optional(supportedLanguagesSchema),
});

export const lessonVideoProgressResponseSchema = Type.Object({
  lessonId: UUIDSchema,
  resourceEntityId: UUIDSchema,
  durationSeconds: Type.Number(),
  bucketSizeSeconds: Type.Number(),
  coveredBucketCount: Type.Number(),
  coveragePercent: Type.Number(),
  watchedRanges: Type.Array(lessonVideoProgressRangeSchema),
  isWatched: Type.Boolean(),
  watchedAt: Type.Union([Type.String(), Type.Null()]),
  lessonCompleted: Type.Boolean(),
});

export type UpsertLessonVideoProgress = Static<typeof upsertLessonVideoProgressSchema>;
export type LessonVideoProgressResponse = Static<typeof lessonVideoProgressResponseSchema>;
