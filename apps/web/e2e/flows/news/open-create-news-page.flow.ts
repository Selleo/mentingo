import { NEWS_FORM_PAGE_HANDLES, NEWS_PAGE_HANDLES } from "../../data/news/handles";

import type { Page } from "@playwright/test";

export const openCreateNewsPageFlow = async (page: Page) => {
  await page.goto("/news");
  await page.getByTestId(NEWS_PAGE_HANDLES.CREATE_BUTTON).click();
  await page.getByTestId(NEWS_FORM_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
