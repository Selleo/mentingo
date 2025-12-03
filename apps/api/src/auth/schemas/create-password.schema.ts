import { type Static, Type } from "@sinclair/typebox";

import { passwordSchema } from "./password.schema";

export const createPasswordSchema = Type.Object({
  password: passwordSchema,
  createToken: Type.String({ minLength: 1 }),
  language: Type.String(),
});

export type CreatePasswordBody = Static<typeof createPasswordSchema>;
