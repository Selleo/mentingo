import { expect, type Page } from "@playwright/test";

import { NEWS_DETAILS_PAGE_HANDLES } from "../../data/news/handles";

/** Deletes the news shown on the details page through its confirmation dialog. */
export const deleteNewsFlow = async (page: Page) => {
  await page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.DELETE_BUTTON).click();
  await expect(page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.DELETE_DIALOG)).toBeVisible();
  await page.getByTestId(NEWS_DETAILS_PAGE_HANDLES.DELETE_CONFIRM_BUTTON).click();
};
