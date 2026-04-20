import { CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";

type FillCategoryFormFlowInput = {
  title?: string;
  archived?: boolean;
};

export const fillCategoryFormFlow = async (
  page: Page,
  { title, archived }: FillCategoryFormFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(CATEGORY_PAGE_HANDLES.TITLE).fill(title);
  }

  if (archived !== undefined) {
    const archivedCheckbox = page.getByTestId(CATEGORY_PAGE_HANDLES.ARCHIVED);

    if ((await archivedCheckbox.isChecked()) !== archived) {
      await archivedCheckbox.click();
    }
  }
};
