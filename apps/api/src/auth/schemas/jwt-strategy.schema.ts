import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { USER_ROLES } from "src/user/schemas/userRoles";

export const jwtPayloadSchema = Type.Object({
  userId: UUIDSchema,
  email: Type.String({ format: "email" }),
  role: Type.Enum(USER_ROLES),
  tenantId: UUIDSchema,
  isSupportMode: Type.Optional(Type.Boolean()),
  supportSessionId: Type.Optional(UUIDSchema),
  supportExpiresAt: Type.Optional(Type.String()),
  originalUserId: Type.Optional(UUIDSchema),
  originalTenantId: Type.Optional(UUIDSchema),
  originalTenantName: Type.Optional(Type.String()),
  targetTenantName: Type.Optional(Type.String()),
  returnUrl: Type.Optional(Type.String()),
});

export type JwtPayload = Static<typeof jwtPayloadSchema>;
