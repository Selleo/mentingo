import { expect, type Page } from "@playwright/test";

export const prepareNavigationPageFlow = async (page: Page) => {
  await page.goto("/progress");
  await expect(page).toHaveURL("/progress");
};
