import { CREATE_CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

type FillCreateCategoryFormFlowInput = {
  title?: string;
  language?: SupportedLanguages;
};

export const fillCreateCategoryFormFlow = async (
  page: Page,
  { title, language }: FillCreateCategoryFormFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(CREATE_CATEGORY_PAGE_HANDLES.TITLE_INPUT).fill(title);
  }

  if (language !== undefined) {
    await page.getByTestId(CREATE_CATEGORY_PAGE_HANDLES.LANGUAGE_SELECT).click();
    await page.getByTestId(CREATE_CATEGORY_PAGE_HANDLES.languageOption(language)).click();
  }
};
