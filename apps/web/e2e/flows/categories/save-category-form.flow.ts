import { CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

export const saveCategoryFormFlow = async (page: Page) => {
  await page.getByTestId(CATEGORY_PAGE_HANDLES.SAVE).click();
};
