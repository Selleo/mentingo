import { CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

type FillCategoryFormFlowInput = {
  title?: string;
};

export const fillCategoryFormFlow = async (page: Page, { title }: FillCategoryFormFlowInput) => {
  if (title !== undefined) {
    await page.getByTestId(CATEGORY_PAGE_HANDLES.TITLE).fill(title);
  }
};
