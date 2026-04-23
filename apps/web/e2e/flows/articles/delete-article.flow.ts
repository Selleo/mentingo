import { ARTICLE_DETAILS_PAGE_HANDLES } from "../../data/articles/handles";

import type { Page } from "@playwright/test";

export const deleteArticleFlow = async (page: Page) => {
  await page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.DELETE_BUTTON).click();
  await page.getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.DELETE_CONFIRM_BUTTON).click();
};
