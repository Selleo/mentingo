import { NEWS_FORM_PAGE_HANDLES } from "../../data/news/handles";

import type { Page } from "@playwright/test";

export const submitNewsFormFlow = async (page: Page) => {
  await page.getByTestId(NEWS_FORM_PAGE_HANDLES.SAVE_BUTTON).click();
};
