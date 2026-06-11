import { COURSE_GENERATION_SYNC_STATUS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

/**
 * `integrationId` is equivalent to the courseId
 */
export const chatOptionsSchema = Type.Object({
  integrationId: UUIDSchema,
  message: Type.String(),
});

export const integrationIdSchema = Type.Object({
  integrationId: UUIDSchema,
});

export const courseGenerationSyncStatusSchema = Type.Object({
  status: Type.Enum(COURSE_GENERATION_SYNC_STATUS),
  draftId: Type.Union([UUIDSchema, Type.Null()]),
  attemptCount: Type.Number(),
  startedAt: Type.Union([Type.String(), Type.Null()]),
  processedAt: Type.Union([Type.String(), Type.Null()]),
  failedAt: Type.Union([Type.String(), Type.Null()]),
  dismissedAt: Type.Union([Type.String(), Type.Null()]),
  lastError: Type.Union([Type.String(), Type.Null()]),
});

export const integrationDraftSchema = Type.Object({
  integrationId: UUIDSchema,
  draftName: Type.String({ minLength: 1 }),
  courseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
});

export const courseGenerationDraftSchema = Type.Object({
  integrationId: UUIDSchema,
  draftId: UUIDSchema,
  isCourseGenerated: Type.Boolean(),
  coreSync: courseGenerationSyncStatusSchema,
});

export const courseGenerationMessageSchema = Type.Object({
  id: UUIDSchema,
  draftId: UUIDSchema,
  role: Type.String(),
  content: Type.String(),
  contentType: Type.String(),
  draftMetadata: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Any()), Type.Null()])),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const courseGenerationMessagesSchema = Type.Array(courseGenerationMessageSchema);

export const courseGenerationIngestBodySchema = Type.Object({
  integrationId: UUIDSchema,
});

export const courseGenerationFileParamsSchema = Type.Object({
  integrationId: UUIDSchema,
});

export const deleteCourseGenerationFileParamsSchema = Type.Object({
  integrationId: UUIDSchema,
  documentId: UUIDSchema,
});

export const courseGenerationFileSchema = Type.Object({
  id: UUIDSchema,
  filename: Type.String(),
  contentType: Type.String(),
});

export const courseGenerationFilesSchema = Type.Array(courseGenerationFileSchema);
