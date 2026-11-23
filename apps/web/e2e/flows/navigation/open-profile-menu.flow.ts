import { expect, type Page } from "@playwright/test";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";

/**
 * Opens the sidebar profile menu until the given item is visible.
 * Decides from the trigger's expanded state, not the item: right after picking an item the
 * previous menu is still animating closed, so its items stay visible but are about to detach.
 * A click can also land while that menu returns focus and leave it closed, so retry the click.
 */
export const openProfileMenuFlow = async (page: Page, itemHandle: string) => {
  const footer = page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER);
  const item = page.getByTestId(itemHandle);

  await expect(footer).toBeVisible();
  await expect(async () => {
    if ((await footer.getAttribute("aria-expanded")) !== "true") await footer.click();
    await expect(footer).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    await expect(item).toBeVisible({ timeout: 1_000 });
  }).toPass();
};
