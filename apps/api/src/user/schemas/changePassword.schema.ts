import { type Static, Type } from "@sinclair/typebox";

import { passwordSchema } from "src/auth/schemas/password.schema";

export const changePasswordSchema = Type.Object({
  newPassword: passwordSchema,
  confirmPassword: Type.String(),
  oldPassword: Type.Optional(Type.String({ minLength: 8, maxLength: 64 })),
});

export const passwordStatusSchema = Type.Object({
  hasPassword: Type.Boolean(),
});

export type ChangePasswordBody = Static<typeof changePasswordSchema>;
export type PasswordStatusResponse = Static<typeof passwordStatusSchema>;
