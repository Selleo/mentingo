import {
  ACTIVITY_LOG_ACTION_TYPES,
  SUPPORT_USER_SCOPES,
  SUPPORTED_LANGUAGES,
  TENANT_STATUSES,
} from "@repo/shared";
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

export const tenantListSortFields = ["lastActivity", "activityCountLast14Days"] as const;

export const tenantListSortSchema = Type.Union([
  ...tenantListSortFields.map((field) => Type.Literal(field)),
  ...tenantListSortFields.map((field) => Type.Literal(`-${field}`)),
]);

export const tenantsListItemSchema = Type.Intersect([
  tenantResponseSchema,
  Type.Object({
    isCurrentTenant: Type.Boolean(),
    lastActivity: Type.Union([
      Type.Object({
        occurredAt: Type.String(),
        actorEmail: Type.String({ format: "email" }),
      }),
      Type.Null(),
    ]),
    recentActivities: Type.Array(
      Type.Object({
        id: UUIDSchema,
        occurredAt: Type.String(),
        actorEmail: Type.String({ format: "email" }),
        actionType: Type.Enum(ACTIVITY_LOG_ACTION_TYPES),
      }),
      { maxItems: 5 },
    ),
    activityCountLast14Days: Type.Integer({ minimum: 0 }),
    activityTrendPercentage: Type.Union([Type.Integer(), Type.Null()]),
    activeUsersLast14Days: Type.Integer({ minimum: 0 }),
    totalUsers: Type.Integer({ minimum: 0 }),
  }),
]);

export const tenantsListSchema = Type.Array(tenantsListItemSchema);

export const listTenantsQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  perPage: Type.Optional(Type.Number({ minimum: 1 })),
  search: Type.Optional(Type.String()),
  status: Type.Optional(Type.Enum(TENANT_STATUSES)),
  sort: Type.Optional(tenantListSortSchema),
});

export const createTenantSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    host: Type.String({ minLength: 1 }),
    status: Type.Optional(Type.Enum(TENANT_STATUSES)),
    adminEmail: Type.String({ format: "email" }),
    adminFirstName: Type.String({ minLength: 1 }),
    adminLastName: Type.String({ minLength: 1 }),
    adminLanguage: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
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

export const createSupportSessionSchema = Type.Object(
  {
    targetUserId: UUIDSchema,
  },
  { additionalProperties: false },
);

export const createSupportSessionResponseSchema = Type.Object({
  redirectUrl: Type.String(),
  expiresAt: Type.String(),
});

export const supportUserScopeSchema = Type.Union([
  Type.Literal(SUPPORT_USER_SCOPES.ADMINS),
  Type.Literal(SUPPORT_USER_SCOPES.ALL),
]);

export const supportUserRoleSchema = Type.Object({
  id: UUIDSchema,
  slug: Type.String(),
  name: Type.String(),
  isSystem: Type.Boolean(),
});

export const supportUserSchema = Type.Object({
  id: UUIDSchema,
  email: Type.String({ format: "email" }),
  firstName: Type.String(),
  lastName: Type.String(),
  label: Type.String(),
  profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
  roles: Type.Array(supportUserRoleSchema),
});

export const supportUsersSchema = Type.Array(supportUserSchema);
export const supportRolesSchema = Type.Array(supportUserRoleSchema);
