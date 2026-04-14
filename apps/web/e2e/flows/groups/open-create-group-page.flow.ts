import { CREATE_GROUP_PAGE_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const openCreateGroupPageFlow = async (page: Page) => {
  await page.goto("/admin/groups/new");
  await page.getByTestId(CREATE_GROUP_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
