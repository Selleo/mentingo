import { expect, type Page } from "@playwright/test";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";

/** Expands the sidebar "Content" group unless one of its links is already visible. */
export const openContentMenuFlow = async (page: Page) => {
  const contentLinks = page
    .getByTestId(NAVIGATION_HANDLES.NEWS_LINK)
    .or(page.getByTestId(NAVIGATION_HANDLES.ARTICLES_LINK))
    .or(page.getByTestId(NAVIGATION_HANDLES.QA_LINK))
    .first();

  await expect(page.getByTestId(NAVIGATION_HANDLES.CONTENT_GROUP)).toBeVisible();

  if (await contentLinks.isVisible()) return;

  await page.getByTestId(NAVIGATION_HANDLES.CONTENT_GROUP).click();
  await expect(contentLinks).toBeVisible();
};
