import { NEWS_DETAILS_PAGE_HANDLES } from "../../data/news/handles";

import type { Page } from "@playwright/test";

export const openNewsDetailsPageFlow = async (page: Page, newsId: string) => {
  await page.goto(`/news/${newsId}`);
  await page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
