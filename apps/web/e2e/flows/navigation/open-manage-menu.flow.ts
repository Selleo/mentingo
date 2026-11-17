import { expect, type Page } from "@playwright/test";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";

/** Expands the sidebar "Manage" group unless its links are already visible. */
export const openManageMenuFlow = async (page: Page) => {
  const usersLink = page.getByTestId(NAVIGATION_HANDLES.USERS_LINK);

  if (await usersLink.isVisible()) return;

  await page.getByTestId(NAVIGATION_HANDLES.MANAGE_TOGGLE).click();
  await expect(usersLink).toBeVisible();
};
