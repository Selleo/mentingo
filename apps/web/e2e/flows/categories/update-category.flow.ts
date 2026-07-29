import { CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";

import { fillCategoryFormFlow } from "./fill-category-form.flow";
import { saveCategoryFormFlow } from "./save-category-form.flow";

import type { Page } from "@playwright/test";

type UpdateCategoryTitleFlowInput = {
  categoryId: string;
  title?: string;
};

export const updateCategoryTitleFlow = async (
  page: Page,
  { categoryId, title }: UpdateCategoryTitleFlowInput,
) => {
  await page.goto(`/admin/categories/${categoryId}`);
  await page.getByTestId(CATEGORY_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
  await fillCategoryFormFlow(page, { title });
  await saveCategoryFormFlow(page);
};
