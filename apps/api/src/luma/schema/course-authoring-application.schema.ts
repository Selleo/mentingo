/** TypeBox contracts for frozen exports, application status, and source-upload responses. */
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { authoringOperationSchema } from "./course-authoring-operations.schema";

export const frozenAuthoringExportSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  exportId: UUIDSchema,
  sessionId: UUIDSchema,
  courseId: UUIDSchema,
  language: Type.Enum(SUPPORTED_LANGUAGES),
  exportHash: Type.String({ pattern: "^[0-9a-f]{64}$" }),
  proposalIds: Type.Array(UUIDSchema),
  operations: Type.Array(authoringOperationSchema),
  assets: Type.Array(
    Type.Object({
      assetId: UUIDSchema,
      sha256: Type.String({ pattern: "^[0-9a-f]{64}$" }),
      mimeType: Type.String(),
      revision: Type.Integer({ minimum: 1 }),
      byteSize: Type.Integer({ minimum: 0 }),
      required: Type.Boolean(),
      role: Type.Optional(Type.Union([Type.Literal("visual"), Type.Literal("mentor_context")])),
      operationId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
      sourceVersionId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
      sectionIds: Type.Optional(Type.Array(UUIDSchema)),
    }),
  ),
  createdAt: Type.String(),
});
export const authoringApplicationResultSchema = Type.Object({
  applicationId: UUIDSchema,
  exportHash: Type.String(),
  status: Type.Literal("applied"),
  exportId: UUIDSchema,
  courseId: UUIDSchema,
  sessionId: UUIDSchema,
  appliedOperationIds: Type.Array(UUIDSchema),
  entityMappings: Type.Record(Type.String(), Type.String()),
  assetMappings: Type.Record(Type.String(), Type.String()),
});
export const authoringApplyStatusSchema = Type.Object({
  data: Type.Object({
    exportId: UUIDSchema,
    status: Type.Union([
      Type.Literal("queued"),
      Type.Literal("running"),
      Type.Literal("applied"),
      Type.Literal("failed"),
      Type.Literal("conflict"),
    ]),
    receipt: Type.Optional(authoringApplicationResultSchema),
    reason: Type.Optional(Type.String()),
  }),
});
export const authoringSourceUploadResponseSchema = Type.Object({
  data: Type.Object({
    sourceVersionId: UUIDSchema,
    checksum: Type.String(),
    taskId: UUIDSchema,
    status: Type.String(),
  }),
});
export type FrozenAuthoringExport = Static<typeof frozenAuthoringExportSchema>;
export type AuthoringApplyStatus = Static<typeof authoringApplyStatusSchema>["data"];
export type AuthoringSourceUploadResponse = Static<
  typeof authoringSourceUploadResponseSchema
>["data"];
