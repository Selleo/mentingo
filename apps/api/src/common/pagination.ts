import type { PgSelect } from "drizzle-orm/pg-core";

export const DEFAULT_PAGE_SIZE = 20;

export function parsePagination(
  page?: number | string,
  perPage?: number | string,
  defaults: { page?: number; perPage?: number } = {},
) {
  return {
    page: parsePositiveNumber(page, defaults.page ?? 1),
    perPage: parsePositiveNumber(perPage, defaults.perPage ?? DEFAULT_PAGE_SIZE),
  };
}

export function addPagination<T extends PgSelect>(
  queryDB: T,
  page: number = 1,
  perPage: number = DEFAULT_PAGE_SIZE,
) {
  return queryDB.limit(perPage).offset((page - 1) * perPage);
}

function parsePositiveNumber(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
