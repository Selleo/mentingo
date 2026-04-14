import { CATEGORIES_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

export const confirmDeleteCategoriesFlow = async (page: Page) => {
  await page.getByTestId(CATEGORIES_PAGE_HANDLES.DELETE_SELECTED_BUTTON).click();
  await page.getByTestId(CATEGORIES_PAGE_HANDLES.DELETE_DIALOG).waitFor({ state: "visible" });
  await page.getByTestId(CATEGORIES_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON).click();
};
