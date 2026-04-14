import { CATEGORIES_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

export const openCategoriesPageFlow = async (page: Page) => {
  await page.goto("/admin/categories");
  await page.getByTestId(CATEGORIES_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
