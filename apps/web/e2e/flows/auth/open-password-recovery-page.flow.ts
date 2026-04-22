import { expect, type Page } from "@playwright/test";

import { PASSWORD_RECOVERY_PAGE_HANDLES } from "../../data/auth/handles";

export const openPasswordRecoveryPageFlow = async (page: Page) => {
  await page.context().clearCookies();

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto("/auth/password-recovery");
  await expect(page).toHaveURL("/auth/password-recovery");
  await expect(page.getByTestId(PASSWORD_RECOVERY_PAGE_HANDLES.PAGE)).toBeVisible();
};
