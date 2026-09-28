import { type Static, Type } from "@sinclair/typebox";

import { userPhoneFieldsSchema } from "src/common/schemas/common-user.schema";
import { baseUserResponseSchema, userOnboardingStatusSchema } from "src/user/schemas/user.schema";

export const loginSchema = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 8, maxLength: 64 }),
  rememberMe: Type.Optional(Type.Boolean()),
});

export const loginResponseSchema = Type.Object({
  ...baseUserResponseSchema.properties,
  ...userPhoneFieldsSchema.properties,
  shouldVerifyMFA: Type.Boolean(),
  requiresPasswordChange: Type.Boolean(),
  onboardingStatus: userOnboardingStatusSchema,
  isManagingTenantAdmin: Type.Boolean(),
});

export type LoginBody = Static<typeof loginSchema>;
export type LoginResponse = Static<typeof loginResponseSchema>;
