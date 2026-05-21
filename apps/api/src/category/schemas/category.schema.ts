import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const categoryLanguageSchema = Type.Enum(SUPPORTED_LANGUAGES);

export const categorySchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  availableLocales: Type.Array(categoryLanguageSchema),
  baseLanguage: categoryLanguageSchema,
  archived: Type.Union([Type.Boolean(), Type.Null()]),
  createdAt: Type.Union([Type.String(), Type.Null()]),
});

export type CategorySchema = Static<typeof categorySchema>;
export type AllCategoriesResponse = Static<typeof categorySchema>[];
