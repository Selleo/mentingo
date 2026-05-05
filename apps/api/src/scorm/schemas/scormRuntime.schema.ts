import { SCORM_COMPLETION_STATUS, SCORM_SUCCESS_STATUS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

const scormRuntimeValuesSchema = Type.Record(Type.String(), Type.String());

export const scormLaunchResponseSchema = Type.Object({
  attemptId: UUIDSchema,
  packageId: UUIDSchema,
  scoId: UUIDSchema,
  lessonId: UUIDSchema,
  courseId: UUIDSchema,
  launchUrl: Type.String(),
  scoTitle: Type.String(),
  navigation: Type.Object({
    previousScoId: Type.Union([UUIDSchema, Type.Null()]),
    nextScoId: Type.Union([UUIDSchema, Type.Null()]),
  }),
  runtime: scormRuntimeValuesSchema,
});

export type ScormLaunchResponse = Static<typeof scormLaunchResponseSchema>;

export const scormRuntimeCommitSchema = Type.Object({
  attemptId: UUIDSchema,
  packageId: UUIDSchema,
  scoId: UUIDSchema,
  lessonId: UUIDSchema,
  courseId: UUIDSchema,
  values: scormRuntimeValuesSchema,
  language: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
});

export type ScormRuntimeCommitBody = Static<typeof scormRuntimeCommitSchema>;

export const scormRuntimeCommitResponseSchema = Type.Object({
  committed: Type.Boolean(),
  lessonCompleted: Type.Boolean(),
  scormStatus: Type.Union([Type.String(), Type.Null()]),
  nextScoId: Type.Union([UUIDSchema, Type.Null()]),
});

export type ScormRuntimeCommitResponse = Static<typeof scormRuntimeCommitResponseSchema>;

export const scormRuntimeFinishSchema = scormRuntimeCommitSchema;

export type ScormRuntimeFinishBody = Static<typeof scormRuntimeFinishSchema>;

export const scormRuntimeFinishResponseSchema = Type.Object({
  finished: Type.Boolean(),
  lessonCompleted: Type.Boolean(),
  scormStatus: Type.Union([Type.String(), Type.Null()]),
  nextScoId: Type.Union([UUIDSchema, Type.Null()]),
});

export type ScormRuntimeFinishResponse = Static<typeof scormRuntimeFinishResponseSchema>;

export const scormNormalizedRuntimeStateSchema = Type.Object({
  completionStatus: Type.Enum(SCORM_COMPLETION_STATUS),
  successStatus: Type.Enum(SCORM_SUCCESS_STATUS),
});
