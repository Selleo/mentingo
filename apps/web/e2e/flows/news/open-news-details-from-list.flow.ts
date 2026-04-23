import { NEWS_PAGE_HANDLES } from "../../data/news/handles";

import type { Page } from "@playwright/test";

export const openNewsDetailsFromListFlow = async (page: Page, newsId: string) => {
  await page.getByTestId(NEWS_PAGE_HANDLES.item(newsId)).click();
};
