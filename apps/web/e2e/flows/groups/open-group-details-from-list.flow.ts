import { GROUPS_PAGE_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const openGroupDetailsFromListFlow = async (page: Page, groupId: string) => {
  await page.getByTestId(GROUPS_PAGE_HANDLES.row(groupId)).click();
};
