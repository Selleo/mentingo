import { expect, type Page } from "@playwright/test";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";

/**
 * Expands the sidebar "Content" group unless one of its links is already visible.
 * Like the Manage group, the expanded state is restored after render, so retry instead of
 * deciding from one snapshot.
 */
export const openContentMenuFlow = async (page: Page) => {
  const contentGroup = page.getByTestId(NAVIGATION_HANDLES.CONTENT_GROUP);
  const contentLinks = page
    .getByTestId(NAVIGATION_HANDLES.NEWS_LINK)
    .or(page.getByTestId(NAVIGATION_HANDLES.ARTICLES_LINK))
    .or(page.getByTestId(NAVIGATION_HANDLES.QA_LINK))
    .first();

  await expect(contentGroup).toBeVisible();
  await expect(async () => {
    if (!(await contentLinks.isVisible())) await contentGroup.click();
    await expect(contentLinks).toBeVisible({ timeout: 1_000 });
  }).toPass();
};
