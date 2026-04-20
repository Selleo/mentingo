import { USER_PAGE_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

export const openUserPageFlow = async (page: Page, userId: string) => {
  await page.goto(`/admin/users/${userId}`);
  await page.getByTestId(USER_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
