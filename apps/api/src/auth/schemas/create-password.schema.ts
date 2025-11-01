import { type Static, Type } from "@sinclair/typebox";

import { SUPPORTED_LANGUAGES } from "src/ai/utils/ai.type";

import { passwordSchema } from "./password.schema";

export const createPasswordSchema = Type.Object({
  password: passwordSchema,
  createToken: Type.String({ minLength: 1 }),
  language: Type.Enum(SUPPORTED_LANGUAGES),
});

export type CreatePasswordBody = Static<typeof createPasswordSchema>;
