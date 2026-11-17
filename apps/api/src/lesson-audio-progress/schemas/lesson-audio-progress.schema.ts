import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const lessonAudioProgressRangeSchema = Type.Tuple([
  Type.Number({ minimum: 0 }),
  Type.Number({ minimum: 0 }),
]);

export const upsertLessonAudioProgressSchema = Type.Object({
  lessonId: UUIDSchema,
  resourceEntityId: UUIDSchema,
  durationSeconds: Type.Number({ minimum: 1 }),
  bucketSize: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  listenedRanges: Type.Array(lessonAudioProgressRangeSchema),
  activeListenSecondsDelta: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
  language: Type.Optional(supportedLanguagesSchema),
});

export const lessonAudioProgressResponseSchema = Type.Object({
  lessonId: UUIDSchema,
  resourceEntityId: UUIDSchema,
  durationSeconds: Type.Number(),
  bucketSizeSeconds: Type.Number(),
  coveredBucketCount: Type.Number(),
  coveragePercent: Type.Number(),
  listenedRanges: Type.Array(lessonAudioProgressRangeSchema),
  isListened: Type.Boolean(),
  listenedAt: Type.Union([Type.String(), Type.Null()]),
  lessonCompleted: Type.Boolean(),
});

export type UpsertLessonAudioProgress = Static<typeof upsertLessonAudioProgressSchema>;
export type LessonAudioProgressResponse = Static<typeof lessonAudioProgressResponseSchema>;
