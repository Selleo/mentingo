import { CATEGORIES_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

type FilterCategoriesFlowInput = {
  title?: string;
  archivedStatus?: "all" | "active" | "archived";
};

export const filterCategoriesFlow = async (
  page: Page,
  { title, archivedStatus }: FilterCategoriesFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(CATEGORIES_PAGE_HANDLES.SEARCH_INPUT).fill(title);
  }

  if (archivedStatus) {
    await page.getByTestId(CATEGORIES_PAGE_HANDLES.STATUS_FILTER).click();
    await page.getByTestId(CATEGORIES_PAGE_HANDLES.statusFilterOption(archivedStatus)).click();
  }
};
