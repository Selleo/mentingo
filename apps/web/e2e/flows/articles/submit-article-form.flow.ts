import { ARTICLE_FORM_PAGE_HANDLES } from "../../data/articles/handles";

import type { Page } from "@playwright/test";

export const submitArticleFormFlow = async (page: Page) => {
  await page.getByTestId(ARTICLE_FORM_PAGE_HANDLES.SAVE_BUTTON).click();
};
