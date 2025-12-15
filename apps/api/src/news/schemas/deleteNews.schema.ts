import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const deleteNewsLanguageResponseSchema = Type.Object({
  id: UUIDSchema,
  availableLocales: Type.Array(Type.String()),
});

export const deleteNewsResponseSchema = Type.Object({
  id: UUIDSchema,
});

export type DeleteNewsLanguageResponse = Static<typeof deleteNewsLanguageResponseSchema>;
export type DeleteNewsResponse = Static<typeof deleteNewsResponseSchema>;
