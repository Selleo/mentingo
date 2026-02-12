import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const integrationKeyMetadataSchema = Type.Object({
  id: UUIDSchema,
  keyPrefix: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  lastUsedAt: Type.Union([Type.String(), Type.Null()]),
});

export const integrationCurrentKeyResponseSchema = Type.Object({
  key: Type.Union([integrationKeyMetadataSchema, Type.Null()]),
});

export const rotateIntegrationKeyResponseSchema = Type.Object({
  key: Type.String(),
  metadata: integrationKeyMetadataSchema,
});

export type IntegrationKeyMetadata = Static<typeof integrationKeyMetadataSchema>;
export type IntegrationCurrentKeyResponse = Static<typeof integrationCurrentKeyResponseSchema>;
export type RotateIntegrationKeyResponse = Static<typeof rotateIntegrationKeyResponseSchema>;
