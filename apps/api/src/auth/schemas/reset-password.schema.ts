import { type Static, Type } from "@sinclair/typebox";

import { passwordSchema } from "./password.schema";

export const forgotPasswordSchema = Type.Object({
  email: Type.String({ format: "email", minLength: 1 }),
});

export const resetPasswordSchema = Type.Object({
  newPassword: passwordSchema,
  resetToken: Type.String({ minLength: 1 }),
});

export type ForgotPasswordBody = Static<typeof forgotPasswordSchema>;
export type ResetPasswordBody = Static<typeof resetPasswordSchema>;
