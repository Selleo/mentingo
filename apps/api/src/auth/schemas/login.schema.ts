import { type Static, Type } from "@sinclair/typebox";

import { baseUserResponseSchema, userOnboardingStatusSchema } from "src/user/schemas/user.schema";

export const loginSchema = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 8, maxLength: 64 }),
  rememberMe: Type.Optional(Type.Boolean()),
});

export const loginResponseSchema = Type.Object({
  ...baseUserResponseSchema.properties,
  shouldVerifyMFA: Type.Boolean(),
  onboardingStatus: userOnboardingStatusSchema,
  isManagingTenantAdmin: Type.Boolean(),
  accessToken: Type.Optional(Type.String()),
  refreshToken: Type.Optional(Type.String()),
  mfaChallengeToken: Type.Optional(Type.String()),
});

export const refreshTokensResponseSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
});

export type LoginBody = Static<typeof loginSchema>;
export type LoginResponse = Static<typeof loginResponseSchema>;
