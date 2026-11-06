import { AUTH_TOKEN_PURPOSE, PERMISSIONS } from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { USER_LOGIN_METHOD } from "src/events/user/user-login.event";

import { AUTH_TOKEN_VERSION } from "../session/session.constants";

const sessionProperties = {
  tokenVersion: Type.Literal(AUTH_TOKEN_VERSION),
  tokenPurpose: Type.Union([
    Type.Literal(AUTH_TOKEN_PURPOSE.ACCESS),
    Type.Literal(AUTH_TOKEN_PURPOSE.REFRESH),
  ]),
  mfaVerified: Type.Boolean(),
  sessionVersion: Type.String({ minLength: 32 }),
  jti: Type.String({ minLength: 16 }),
  exp: Type.Integer(),
  iat: Type.Integer(),
};

export const jwtPayloadSchema = Type.Object({
  sessionId: Type.String({ minLength: 32 }),
  ...sessionProperties,
  userId: UUIDSchema,
  email: Type.String({ format: "email" }),
  roleSlugs: Type.Array(Type.String()),
  permissions: Type.Array(
    Type.Union(Object.values(PERMISSIONS).map((permission) => Type.Literal(permission))),
  ),
  tenantId: UUIDSchema,
  isSupportMode: Type.Optional(Type.Boolean()),
  supportSessionId: Type.Optional(UUIDSchema),
  supportExpiresAt: Type.Optional(Type.String()),
  originalUserId: Type.Optional(UUIDSchema),
  originalUserEmail: Type.Optional(Type.String({ format: "email" })),
  originalTenantId: Type.Optional(UUIDSchema),
  targetUserId: Type.Optional(UUIDSchema),
  returnUrl: Type.Optional(Type.String()),
});

export type JwtPayload = Static<typeof jwtPayloadSchema>;

export const pendingMfaPayloadSchema = Type.Object(
  {
    ...sessionProperties,
    tokenPurpose: Type.Literal(AUTH_TOKEN_PURPOSE.MFA),
    mfaVerified: Type.Literal(false),
    userId: UUIDSchema,
    tenantId: UUIDSchema,
    email: Type.String({ format: "email" }),
    rememberMe: Type.Boolean(),
    loginMethod: Type.Optional(Type.Enum(USER_LOGIN_METHOD)),
  },
  { additionalProperties: false },
);
