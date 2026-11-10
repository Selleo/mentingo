import { CATEGORIES_PAGE_HANDLES } from "../../data/categories/handles";
import { waitForSearchParam } from "../../utils/wait-for-search-param";

import type { Page } from "@playwright/test";

type FilterCategoriesFlowInput = {
  title?: string;
};

export const filterCategoriesFlow = async (page: Page, { title }: FilterCategoriesFlowInput) => {
  if (title === undefined) return;

  await page.getByTestId(CATEGORIES_PAGE_HANDLES.SEARCH_INPUT).fill(title);
  await waitForSearchParam(page, "title", title);
};
