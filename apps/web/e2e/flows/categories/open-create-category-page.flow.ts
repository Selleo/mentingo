import { CREATE_CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

export const openCreateCategoryPageFlow = async (page: Page) => {
  await page.goto("/admin/categories/new");
  await page.getByTestId(CREATE_CATEGORY_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
