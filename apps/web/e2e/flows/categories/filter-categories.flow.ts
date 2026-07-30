import { CATEGORIES_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

type FilterCategoriesFlowInput = {
  title?: string;
};

export const filterCategoriesFlow = async (page: Page, { title }: FilterCategoriesFlowInput) => {
  if (title !== undefined) {
    await page.getByTestId(CATEGORIES_PAGE_HANDLES.SEARCH_INPUT).fill(title);
  }
};
