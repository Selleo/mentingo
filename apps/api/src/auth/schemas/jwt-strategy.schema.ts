import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const jwtPayloadSchema = Type.Object({
  userId: UUIDSchema,
  email: Type.String({ format: "email" }),
  tenantId: UUIDSchema,
  isSupportMode: Type.Optional(Type.Boolean()),
  supportSessionId: Type.Optional(UUIDSchema),
  supportExpiresAt: Type.Optional(Type.String()),
  originalUserId: Type.Optional(UUIDSchema),
  originalTenantId: Type.Optional(UUIDSchema),
  returnUrl: Type.Optional(Type.String()),
});

export type JwtPayload = Static<typeof jwtPayloadSchema>;
