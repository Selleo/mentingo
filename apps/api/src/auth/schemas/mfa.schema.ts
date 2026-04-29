import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const MFAVerifySchema = Type.Object({
  token: Type.String(),
});

export const MFASetupResponseSchema = Type.Object({
  secret: Type.String(),
  otpauth: Type.String(),
});

export const MFAVerifyResponseSchema = Type.Object({
  isValid: Type.Boolean(),
  accessToken: Type.Optional(Type.String()),
  refreshToken: Type.Optional(Type.String()),
});

export type MFAVerifyBody = Static<typeof MFAVerifySchema>;
export type MFAEnableResponse = Static<typeof MFASetupResponseSchema>;
export type MFAVerifyResponse = Static<typeof MFAVerifyResponseSchema>;
