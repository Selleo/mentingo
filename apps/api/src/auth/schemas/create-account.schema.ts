import { type Static, Type } from "@sinclair/typebox";

import { passwordSchema } from "./password.schema";

export const createAccountSchema = Type.Object({
  email: Type.String({ format: "email" }),
  firstName: Type.String({ minLength: 1, maxLength: 64 }),
  lastName: Type.String({ minLength: 1, maxLength: 64 }),
  password: passwordSchema,
});

export type CreateAccountBody = Static<typeof createAccountSchema>;
