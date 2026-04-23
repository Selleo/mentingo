import { expect, type Page } from "@playwright/test";

import { REGISTER_PAGE_HANDLES } from "../../data/auth/handles";

export const openRegisterPageFlow = async (page: Page) => {
  await page.context().clearCookies();

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto("/auth/register");
  await expect(page).toHaveURL("/auth/register");
  await expect(page.getByTestId(REGISTER_PAGE_HANDLES.PAGE)).toBeVisible();
};
