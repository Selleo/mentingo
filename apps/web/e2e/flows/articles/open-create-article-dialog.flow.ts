import { ARTICLES_TOC_HANDLES, CREATE_ARTICLE_DIALOG_HANDLES } from "../../data/articles/handles";
import { expect } from "../../fixtures/test.fixture";
import { clickVisibleTestIdFlow } from "../click-visible-testid.flow";

import type { Page } from "@playwright/test";

export const openCreateArticleDialogFlow = async (page: Page) => {
  await clickVisibleTestIdFlow(page, ARTICLES_TOC_HANDLES.ADD_ACTION);
  await clickVisibleTestIdFlow(page, ARTICLES_TOC_HANDLES.CREATE_ARTICLE_ACTION);
  await expect(page.getByTestId(CREATE_ARTICLE_DIALOG_HANDLES.DIALOG)).toBeVisible();
};
