import { ARTICLE_DETAILS_PAGE_HANDLES } from "../../data/articles/handles";

import type { Page } from "@playwright/test";

export const openArticleDetailsPageFlow = async (page: Page, articleId: string) => {
  await page.goto(`/articles/${articleId}`);
  await page.waitForURL(new RegExp(`/articles/${articleId}(\\?.*)?$`));
  await page
    .getByTestId(ARTICLE_DETAILS_PAGE_HANDLES.PAGE)
    .waitFor({ state: "visible", timeout: 30_000 });
};
