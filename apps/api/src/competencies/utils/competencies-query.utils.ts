import { match } from "ts-pattern";

import {
  COMPETENCIES_UNCATEGORIZED,
  COMPETENCIES_DEFAULT_PAGE_SIZE,
} from "../schemas/competencies.schema";

import type { CompetencyPageQuery } from "@mentingo/competencies-sdk";

export const normalizePageQuery = (
  query: Partial<Pick<CompetencyPageQuery, "page" | "perPage" | "search">>,
): CompetencyPageQuery => ({
  page: query.page ?? 1,
  perPage: query.perPage ?? COMPETENCIES_DEFAULT_PAGE_SIZE,
  search: query.search?.trim() || undefined,
});

export function normalizeCategoryFilter(categoryId: string | undefined) {
  return match(categoryId)
    .with(COMPETENCIES_UNCATEGORIZED, () => null)
    .otherwise((id) => id);
}
