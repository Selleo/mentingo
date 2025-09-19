import { type Static, Type } from "@sinclair/typebox";

import { baseUserResponseSchema } from "src/user/schemas/user.schema";

export const loginSchema = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 8, maxLength: 64 }),
  rememberMe: Type.Optional(Type.Boolean()),
});

export const loginResponseSchema = Type.Object({
  ...baseUserResponseSchema.properties,
  shouldVerifyMFA: Type.Boolean(),
});

export type LoginBody = Static<typeof loginSchema>;
