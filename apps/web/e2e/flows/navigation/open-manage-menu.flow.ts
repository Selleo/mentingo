import { expect, type Page } from "@playwright/test";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";

/**
 * Expands the sidebar "Manage" group unless its links are already visible.
 * The expanded state is restored from storage after render, so a click may race it;
 * retry until the links stay visible instead of deciding from one snapshot.
 */
export const openManageMenuFlow = async (page: Page) => {
  const toggle = page.getByTestId(NAVIGATION_HANDLES.MANAGE_TOGGLE);
  const usersLink = page.getByTestId(NAVIGATION_HANDLES.USERS_LINK);

  await expect(toggle).toBeVisible();
  await expect(async () => {
    if (!(await usersLink.isVisible())) await toggle.click();
    await expect(usersLink).toBeVisible({ timeout: 1_000 });
  }).toPass();
};
