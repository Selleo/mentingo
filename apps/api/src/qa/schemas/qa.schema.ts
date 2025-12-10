import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const createQASchema = Type.Object({
  title: Type.String(),
  description: Type.String(),

  language: Type.Enum(SUPPORTED_LANGUAGES),
});

export type CreateQABody = Static<typeof createQASchema>;
