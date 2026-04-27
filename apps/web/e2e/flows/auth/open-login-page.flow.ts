import { expect, type Page } from "@playwright/test";

import { LOGIN_PAGE_HANDLES } from "../../data/auth/handles";

type OpenLoginPageOptions = {
  preserveSession?: boolean;
};

export const openLoginPageFlow = async (page: Page, options: OpenLoginPageOptions = {}) => {
  if (!options.preserveSession) {
    await page.context().clearCookies();

    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  await page.goto("/auth/login");
  await expect(page).toHaveURL("/auth/login");
  await expect(page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();
};
