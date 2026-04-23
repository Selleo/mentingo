import { ARTICLES_TOC_HANDLES, CREATE_ARTICLE_DIALOG_HANDLES } from "../../data/articles/handles";
import { expect } from "../../fixtures/test.fixture";

import type { Page } from "@playwright/test";

export const openCreateArticleDialogFlow = async (page: Page) => {
  await page.getByTestId(ARTICLES_TOC_HANDLES.ADD_ACTION).click();
  await page.getByTestId(ARTICLES_TOC_HANDLES.CREATE_ARTICLE_ACTION).click();
  await expect(page.getByTestId(CREATE_ARTICLE_DIALOG_HANDLES.DIALOG)).toBeVisible();
};
