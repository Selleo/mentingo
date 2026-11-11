import { AUTH_SESSION_STATUS } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const MFAVerifySchema = Type.Object({
  token: Type.String({ pattern: "^[0-9]{6}$", minLength: 6, maxLength: 6 }),
});

export const MFASetupResponseSchema = Type.Object({
  secret: Type.String(),
  otpauth: Type.String(),
});

export const MFAVerifyResponseSchema = Type.Object({
  isValid: Type.Boolean(),
});

export type MFAVerifyBody = Static<typeof MFAVerifySchema>;
export type MFAEnableResponse = Static<typeof MFASetupResponseSchema>;
export type MFAVerifyResponse = Static<typeof MFAVerifyResponseSchema>;

export const sessionResponseSchema = Type.Object({
  status: Type.Union([
    Type.Literal(AUTH_SESSION_STATUS.AUTHENTICATED),
    Type.Literal(AUTH_SESSION_STATUS.MFA_REQUIRED),
  ]),
  setupRequired: Type.Optional(Type.Boolean()),
  expiresAt: Type.Optional(Type.Number()),
});
export type SessionResponse = Static<typeof sessionResponseSchema>;
