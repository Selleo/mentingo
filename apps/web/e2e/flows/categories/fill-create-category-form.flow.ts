import { CREATE_CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

type FillCreateCategoryFormFlowInput = {
  title?: string;
};

export const fillCreateCategoryFormFlow = async (
  page: Page,
  { title }: FillCreateCategoryFormFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(CREATE_CATEGORY_PAGE_HANDLES.TITLE_INPUT).fill(title);
  }
};
