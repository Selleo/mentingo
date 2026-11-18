import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const integrationKeyMetadataSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  keyPrefix: Type.String(),
  createdAt: Type.String(),
  lastUsedAt: Type.Union([Type.String(), Type.Null()]),
  createdBy: Type.Object({
    id: UUIDSchema,
    email: Type.String(),
  }),
});

export const integrationKeysResponseSchema = Type.Array(integrationKeyMetadataSchema);

export const createIntegrationKeySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100, pattern: "\\S" }),
  },
  { additionalProperties: false },
);

export const createIntegrationKeyResponseSchema = Type.Object({
  key: Type.String(),
  metadata: integrationKeyMetadataSchema,
});

export type IntegrationKeyMetadata = Static<typeof integrationKeyMetadataSchema>;
export type IntegrationKeysResponse = Static<typeof integrationKeysResponseSchema>;
export type CreateIntegrationKeyBody = Static<typeof createIntegrationKeySchema>;
export type CreateIntegrationKeyResponse = Static<typeof createIntegrationKeyResponseSchema>;
