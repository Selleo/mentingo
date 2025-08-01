import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const mfaVerifySchema = Type.Object({
  token: Type.String(),
});

export const mfaSetupResponseSchema = Type.Object({
  secret: Type.String(),
  otpauth: Type.String(),
});

export const mfaVerifyResponseSchema = Type.Object({
  isValid: Type.Boolean(),
});

export type MFAVerifyBody = Static<typeof mfaVerifySchema>;
export type MFAEnableResponse = Static<typeof mfaSetupResponseSchema>;
export type MFAVerifyResponse = Static<typeof mfaVerifyResponseSchema>;
