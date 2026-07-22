import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const createTranslationSchema = Type.Object({
  key: Type.String(),
});

export type CreateTranslation = Static<typeof createTranslationSchema>;
