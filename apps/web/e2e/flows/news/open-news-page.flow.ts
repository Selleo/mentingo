import { NEWS_PAGE_HANDLES } from "../../data/news/handles";

import type { Page } from "@playwright/test";

export const openNewsPageFlow = async (page: Page) => {
  await page.goto("/news");
  await page.getByTestId(NEWS_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
