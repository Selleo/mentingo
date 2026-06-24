import { ENTITY_TYPES, RESOURCE_LIBRARY_ASSET_TYPE, VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type { Static } from "@sinclair/typebox";

export const resourceLibraryAssetTypeSchema = Type.Enum(RESOURCE_LIBRARY_ASSET_TYPE);

export const richTextAssetEntityTypeSchema = Type.Union([
  Type.Literal(ENTITY_TYPES.LESSON),
  Type.Literal(ENTITY_TYPES.ARTICLES),
  Type.Literal(ENTITY_TYPES.NEWS),
]);

export const assetLibraryAssetSchema = Type.Object({
  id: UUIDSchema,
  fileName: Type.String(),
  title: Type.String(),
  contentType: Type.String(),
  type: resourceLibraryAssetTypeSchema,
  size: Type.Union([Type.Number(), Type.Null()]),
  originalFilename: Type.Union([Type.String(), Type.Null()]),
  reference: Type.String(),
  videoProvider: Type.Optional(Type.Enum(VIDEO_EMBED_PROVIDERS)),
  uploadedBy: Type.Union([UUIDSchema, Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
  usageCount: Type.Number(),
});

export const assetLibraryUsageSchema = Type.Object({
  id: UUIDSchema,
  entityId: UUIDSchema,
  entityType: richTextAssetEntityTypeSchema,
  title: Type.String(),
  relationshipType: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
});

export const linkAssetBodySchema = Type.Object({
  entityId: UUIDSchema,
  entityType: richTextAssetEntityTypeSchema,
  relationshipType: Type.Optional(Type.String()),
});

export const linkAssetResponseSchema = Type.Object({
  resourceId: UUIDSchema,
  url: Type.String(),
});

export const unlinkAssetBodySchema = Type.Object({
  entityId: UUIDSchema,
  entityType: richTextAssetEntityTypeSchema,
  relationshipType: Type.Optional(Type.String()),
});

export const unlinkAssetResponseSchema = Type.Object({
  resourceId: UUIDSchema,
  deletedUsages: Type.Number(),
});

export const uploadAssetBodySchema = Type.Object({
  file: Type.Optional(Type.String({ format: "binary" })),
  entityType: richTextAssetEntityTypeSchema,
  entityId: Type.Optional(UUIDSchema),
  contextId: Type.Optional(UUIDSchema),
  language: supportedLanguagesSchema,
  title: Type.String(),
  description: Type.String(),
});

export const uploadAssetResponseSchema = Type.Object({
  resourceId: UUIDSchema,
  url: Type.String(),
  fileUrl: Type.String(),
});

export const deleteAssetResponseSchema = Type.Object({
  message: Type.String(),
  deletedUsages: Type.Number(),
});

export type ResourceLibraryAssetType = Static<typeof resourceLibraryAssetTypeSchema>;
export type RichTextAssetEntityType = Static<typeof richTextAssetEntityTypeSchema>;
export type LinkAssetBody = Static<typeof linkAssetBodySchema>;
export type UnlinkAssetBody = Static<typeof unlinkAssetBodySchema>;
export type UploadAssetBody = Static<typeof uploadAssetBodySchema>;
export type LinkAssetResponse = Static<typeof linkAssetResponseSchema>;
export type UnlinkAssetResponse = Static<typeof unlinkAssetResponseSchema>;
export type UploadAssetResponse = Static<typeof uploadAssetResponseSchema>;
export type DeleteAssetResponse = Static<typeof deleteAssetResponseSchema>;
export type AssetLibraryAsset = Static<typeof assetLibraryAssetSchema>;
export type AssetLibraryUsage = Static<typeof assetLibraryUsageSchema>;
