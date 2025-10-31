import { type Static, Type } from "@sinclair/typebox";

import { SUPPORTED_LANGUAGES } from "src/ai/utils/ai.type";

import { passwordSchema } from "./password.schema";

export const createAccountSchema = Type.Object({
  email: Type.String({ format: "email" }),
  firstName: Type.String({ minLength: 1, maxLength: 64 }),
  lastName: Type.String({ minLength: 1, maxLength: 64 }),
  password: passwordSchema,
  language: Type.Enum(SUPPORTED_LANGUAGES),
});

export type CreateAccountBody = Static<typeof createAccountSchema>;
