import { GROUP_PAGE_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const openGroupPageFlow = async (page: Page, groupId: string) => {
  await page.goto(`/admin/groups/${groupId}`);
  await page.getByTestId(GROUP_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
