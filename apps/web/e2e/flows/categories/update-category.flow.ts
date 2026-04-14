import { CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

type UpdateCategoryTitleFlowInput = {
  categoryId: string;
  title: string;
};

export const updateCategoryTitleFlow = async (
  page: Page,
  { categoryId, title }: UpdateCategoryTitleFlowInput,
) => {
  await page.goto(`/admin/categories/${categoryId}`);
  await page.getByTestId(CATEGORY_PAGE_HANDLES.HEADING).waitFor({ state: "visible" });
  await page.getByTestId(CATEGORY_PAGE_HANDLES.TITLE).fill(title);
  await page.getByTestId(CATEGORY_PAGE_HANDLES.SAVE).click();
};
