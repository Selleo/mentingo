import { CATEGORIES_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

export const selectCategoriesFlow = async (page: Page, categoryIds: string[]) => {
  for (const categoryId of categoryIds) {
    await page.getByTestId(CATEGORIES_PAGE_HANDLES.rowCheckbox(categoryId)).click();
  }
};
