import { expect, type Page } from "@playwright/test";

import { CREATE_NEW_PASSWORD_PAGE_HANDLES } from "../../data/auth/handles";

export const openCreateNewPasswordPageFlow = async (
  page: Page,
  params: {
    email: string;
    createToken?: string;
    resetToken?: string;
  },
) => {
  await page.context().clearCookies();

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const searchParams = new URLSearchParams({ email: params.email });

  if (params.createToken) searchParams.set("createToken", params.createToken);
  if (params.resetToken) searchParams.set("resetToken", params.resetToken);

  const path = `/auth/create-new-password?${searchParams.toString()}`;

  await page.goto(path);
  await expect(page).toHaveURL(/\/auth\/create-new-password\?/);
  await expect(page.getByTestId(CREATE_NEW_PASSWORD_PAGE_HANDLES.PAGE)).toBeVisible();
};
