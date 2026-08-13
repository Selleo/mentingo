import { ENTITY_TYPES, RESOURCE_VISIBILITY } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const videoInitSchema = Type.Object({
  filename: Type.String({ minLength: 1 }),
  sizeBytes: Type.Integer({ minimum: 1 }),
  mimeType: Type.String({ minLength: 1 }),
  title: Type.Optional(Type.String()),
  resource: Type.Optional(Type.String()),
  contextId: Type.Optional(UUIDSchema),
  entityId: Type.Optional(UUIDSchema),
  entityType: Type.Enum(ENTITY_TYPES),
  relationshipType: Type.Optional(Type.String()),
  linkToEntity: Type.Optional(Type.Boolean()),
  visibility: Type.Optional(
    Type.Union([
      Type.Literal(RESOURCE_VISIBILITY.PUBLIC),
      Type.Literal(RESOURCE_VISIBILITY.PRIVATE),
    ]),
  ),
});

export const videoInitResponseSchema = Type.Object({
  uploadId: UUIDSchema,
  provider: Type.Union([Type.Literal("bunny"), Type.Literal("s3")]),
  fileKey: Type.String(),
  bunnyGuid: Type.Optional(Type.String()),
  tusEndpoint: Type.Optional(Type.String()),
  tusHeaders: Type.Optional(Type.Record(Type.String(), Type.String())),
  expiresAt: Type.Optional(Type.String()),
  multipartUploadId: Type.Optional(Type.String()),
  partSize: Type.Optional(Type.Integer({ minimum: 1 })),
  resourceId: Type.Optional(UUIDSchema),
});

export type VideoInitBody = Static<typeof videoInitSchema>;
export type VideoInitResponse = Static<typeof videoInitResponseSchema>;
