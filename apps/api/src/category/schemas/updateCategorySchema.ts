import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { categoryLanguageSchema } from "./category.schema";

import type { Static } from "@sinclair/typebox";

export const categoryUpdateSchema = Type.Partial(
  Type.Object({
    id: UUIDSchema,
    title: Type.String(),
    archived: Type.Boolean(),
    language: categoryLanguageSchema,
  }),
);

export const categoryBaseLanguageUpdateSchema = Type.Object({
  baseLanguage: categoryLanguageSchema,
});

export type CategoryUpdateBody = Static<typeof categoryUpdateSchema>;
export type CategoryBaseLanguageUpdateBody = Static<typeof categoryBaseLanguageUpdateSchema>;
