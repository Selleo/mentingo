import { expect, type Page } from "@playwright/test";

import { MAGIC_LINK_PAGE_HANDLES } from "../../data/auth/handles";

export const openMagicLinkPageFlow = async (page: Page) => {
  await page.context().clearCookies();

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto("/auth/magic-link");
  await expect(page).toHaveURL("/auth/magic-link");
  await expect(page.getByTestId(MAGIC_LINK_PAGE_HANDLES.PAGE)).toBeVisible();
};
