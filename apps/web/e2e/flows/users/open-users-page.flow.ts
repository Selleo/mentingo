import { USERS_PAGE_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

export const openUsersPageFlow = async (page: Page) => {
  await page.goto("/admin/users");
  await page.getByTestId(USERS_PAGE_HANDLES.HEADING).waitFor({ state: "visible" });
};
