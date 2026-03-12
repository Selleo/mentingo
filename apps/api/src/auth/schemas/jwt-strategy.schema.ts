import { PERMISSIONS } from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const jwtPayloadSchema = Type.Object({
  userId: UUIDSchema,
  email: Type.String({ format: "email" }),
  roleSlugs: Type.Array(Type.String()),
  permissions: Type.Array(Type.Union(Object.values(PERMISSIONS).map((permission) => Type.Literal(permission)))),
  tenantId: UUIDSchema,
  isSupportMode: Type.Optional(Type.Boolean()),
  supportSessionId: Type.Optional(UUIDSchema),
  supportExpiresAt: Type.Optional(Type.String()),
  originalUserId: Type.Optional(UUIDSchema),
  originalTenantId: Type.Optional(UUIDSchema),
  returnUrl: Type.Optional(Type.String()),
});

export type JwtPayload = Static<typeof jwtPayloadSchema>;
