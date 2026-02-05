import { TENANT_STATUSES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const tenantResponseSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  host: Type.String(),
  status: Type.Enum(TENANT_STATUSES),
  isManaging: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const tenantsListSchema = Type.Array(tenantResponseSchema);

export const listTenantsQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  perPage: Type.Optional(Type.Number({ minimum: 1 })),
  search: Type.Optional(Type.String()),
});

export const createTenantSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    host: Type.String({ minLength: 1 }),
    status: Type.Optional(Type.Enum(TENANT_STATUSES)),
    adminEmail: Type.String({ format: "email" }),
    adminFirstName: Type.String({ minLength: 1 }),
    adminLastName: Type.String({ minLength: 1 }),
    adminLanguage: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const updateTenantSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1 })),
    host: Type.Optional(Type.String({ minLength: 1 })),
    status: Type.Optional(Type.Enum(TENANT_STATUSES)),
  },
  { additionalProperties: false },
);
