import type { Page } from "@playwright/test";

/**
 * Waits until a table's debounced search reaches the URL, so the rows a test selects next are the
 * ones the search narrows to.
 */
export const waitForSearchParam = (page: Page, param: string, value: string) =>
  page.waitForURL((url) => (url.searchParams.get(param) ?? "") === value.trim());
