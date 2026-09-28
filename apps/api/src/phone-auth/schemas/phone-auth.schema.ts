import { type Static, Type } from "@sinclair/typebox";

import { PHONE_OTP_CODE_LENGTH } from "../phone-auth.constants";

const phoneInputSchema = Type.String({ minLength: 3, maxLength: 32 });
const otpCodeSchema = Type.String({ pattern: `^\\d{${PHONE_OTP_CODE_LENGTH}}$` });

export const requestPhoneCodeSchema = Type.Object({
  phone: phoneInputSchema,
});

export const verifyPhoneLoginSchema = Type.Object({
  phone: phoneInputSchema,
  code: otpCodeSchema,
  rememberMe: Type.Optional(Type.Boolean()),
});

export const verifyPhoneAttachSchema = Type.Object({
  phone: phoneInputSchema,
  code: otpCodeSchema,
});

export const requestPhoneCodeResponseSchema = Type.Object({
  message: Type.String(),
  resendAvailableInSeconds: Type.Number(),
  codeTtlSeconds: Type.Number(),
});

export const userPhoneResponseSchema = Type.Object({
  phone: Type.Union([Type.String(), Type.Null()]),
  phoneVerifiedAt: Type.Union([Type.String(), Type.Null()]),
});

export const phoneAuthConfigResponseSchema = Type.Object({
  enabled: Type.Boolean(),
});

export type RequestPhoneCodeBody = Static<typeof requestPhoneCodeSchema>;
export type VerifyPhoneLoginBody = Static<typeof verifyPhoneLoginSchema>;
export type VerifyPhoneAttachBody = Static<typeof verifyPhoneAttachSchema>;
export type RequestPhoneCodeResponse = Static<typeof requestPhoneCodeResponseSchema>;
export type UserPhoneResponse = Static<typeof userPhoneResponseSchema>;
export type PhoneAuthConfigResponse = Static<typeof phoneAuthConfigResponseSchema>;
