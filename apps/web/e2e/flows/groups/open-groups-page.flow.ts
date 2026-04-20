import { GROUPS_PAGE_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const openGroupsPageFlow = async (page: Page) => {
  await page.goto("/admin/groups");
  await page.getByTestId(GROUPS_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
