import { CREATE_CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

export const submitCreateCategoryFormFlow = async (page: Page) => {
  await page.getByTestId(CREATE_CATEGORY_PAGE_HANDLES.SUBMIT_BUTTON).click();
};
