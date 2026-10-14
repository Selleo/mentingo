import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const courseTransferRequestedEventSchema = Type.Object({
  operationId: UUIDSchema,
  sourceTenantId: UUIDSchema,
});

export const courseTransferSourceSchema = Type.Object({
  sourceId: UUIDSchema,
});

export const courseTransferStreamKeySchema = Type.Object({
  exportId: UUIDSchema,
  sourceTenantId: UUIDSchema,
  targetTenantId: UUIDSchema,
});

export const courseTransferRelationshipRefSchema = Type.Object({
  id: UUIDSchema,
  sourceTenantId: UUIDSchema,
  sourceId: UUIDSchema,
  targetTenantId: UUIDSchema,
});

export const courseTransferJobSchema = Type.Object({
  exportId: Type.Optional(UUIDSchema),
  operationId: Type.Optional(UUIDSchema),
  sourceTenantId: UUIDSchema,
  sourceId: UUIDSchema,
  targetTenantId: UUIDSchema,
});

export const courseTransferVideoMetadataRequestedEventSchema = Type.Object({
  tenantId: UUIDSchema,
  resourceId: UUIDSchema,
  fileKey: Type.String({ minLength: 1 }),
});
