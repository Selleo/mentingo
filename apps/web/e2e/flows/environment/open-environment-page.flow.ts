import { expect, type Page } from "@playwright/test";

import { ENV_PAGE_HANDLES } from "../../data/environment/handles";

export const openEnvironmentPageFlow = async (page: Page) => {
  await page.goto("/admin/envs");
  await expect(page).toHaveURL("/admin/envs");
  await expect(page.getByTestId(ENV_PAGE_HANDLES.PAGE)).toBeVisible();
};
