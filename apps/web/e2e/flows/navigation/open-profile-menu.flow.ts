import { expect, type Page } from "@playwright/test";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";

/**
 * Opens the sidebar profile menu until the given item is visible.
 * Right after navigating, a click can land while the previous menu still closes and returns
 * focus, so the menu stays closed; retry instead of deciding from one click.
 */
export const openProfileMenuFlow = async (page: Page, itemHandle: string) => {
  const footer = page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER);
  const item = page.getByTestId(itemHandle);

  await expect(footer).toBeVisible();
  await expect(async () => {
    if (!(await item.isVisible())) await footer.click();
    await expect(item).toBeVisible({ timeout: 1_000 });
  }).toPass();
};
