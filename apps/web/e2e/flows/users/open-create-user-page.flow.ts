import { CREATE_USER_PAGE_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

export const openCreateUserPageFlow = async (page: Page) => {
  await page.goto("/admin/users/new");
  await page.getByTestId(CREATE_USER_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
