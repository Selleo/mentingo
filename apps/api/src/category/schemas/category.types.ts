import type { CategoryFilterSchema, SortCategoryFieldsOptions } from "./categoryQuery";
import type { SupportedLanguages } from "@repo/shared";
import type { categories } from "src/storage/schema";

export type CategoryQuery = {
  filters?: CategoryFilterSchema;
  language?: SupportedLanguages;
  page?: number;
  perPage?: number;
  sort?: SortCategoryFieldsOptions;
};

export type CategoryRecord = typeof categories.$inferSelect;
