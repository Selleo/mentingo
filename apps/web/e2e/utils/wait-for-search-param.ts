import type { Page } from "@playwright/test";

/**
 * Waits until a table's debounced search reaches the URL. Tables clear their row selection when
 * the search applies, so selecting rows before this point loses the selection.
 */
export const waitForSearchParam = (page: Page, param: string, value: string) =>
  page.waitForURL((url) => (url.searchParams.get(param) ?? "") === value.trim());
