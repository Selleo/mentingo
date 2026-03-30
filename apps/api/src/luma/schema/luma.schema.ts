import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { GeneratedCourseResponse } from "@japro/luma-sdk";

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

export const integrationDraftSchema = Type.Object({
  integrationId: UUIDSchema,
  draftName: Type.String({ minLength: 1 }),
  courseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
});

export const courseGenerationDraftSchema = Type.Object({
  integrationId: UUIDSchema,
  draftId: UUIDSchema,
  isCourseGenerated: Type.Boolean(),
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

export type GeneratedLesson = {
  type: string;
  generation: GeneratedCourseResponse["chapters"][number]["lessons"][number];
  chapterIndex: number;
  lessonIndex: number;
  relevantContext?: string;
};

export type GeneratedAssetPayload = {
  type: string;
  draftId: string;
};

export type GeneratedChapter = {
  type: string;
  generation: {
    title: string;
  };
};
