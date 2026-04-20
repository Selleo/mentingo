import { CATEGORIES_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

export const openCategoryDetailsFromListFlow = async (page: Page, categoryId: string) => {
  await page.getByTestId(CATEGORIES_PAGE_HANDLES.row(categoryId)).click();
};
