import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { categoryLanguageSchema } from "./category.schema";

import type { SupportedLanguages } from "@repo/shared";

export const categoryUpdateSchema = Type.Partial(
  Type.Object({
    id: UUIDSchema,
    title: Type.String(),
    archived: Type.Boolean(),
    language: categoryLanguageSchema,
  }),
);

export type CategoryUpdateBody = {
  archived?: boolean;
  title?: string;
  language?: SupportedLanguages;
};

export const categoryBaseLanguageUpdateSchema = Type.Object({
  baseLanguage: categoryLanguageSchema,
});

export type CategoryBaseLanguageUpdateBody = {
  baseLanguage: SupportedLanguages;
};
