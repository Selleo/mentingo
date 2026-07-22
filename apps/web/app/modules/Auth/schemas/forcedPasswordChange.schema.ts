import { z } from "zod";

import { passwordSchema } from "~/modules/Dashboard/Settings/schema/password.schema";

export const forcedPasswordChangeSchema = z
  .object({
    oldPassword: z.string().min(1, "changePasswordView.validation.oldPassword"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(({ newPassword, confirmPassword }) => newPassword === confirmPassword, {
    path: ["confirmPassword"],
    message: "changePasswordView.validation.passwordsDontMatch",
  });
