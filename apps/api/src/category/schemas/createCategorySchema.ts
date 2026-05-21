import { Type, type Static } from "@sinclair/typebox";

import { categoryLanguageSchema } from "./category.schema";

export const categoryCreateSchema = Type.Object({
  title: Type.String(),
  language: categoryLanguageSchema,
});

export type CategoryInsert = Static<typeof categoryCreateSchema>;
