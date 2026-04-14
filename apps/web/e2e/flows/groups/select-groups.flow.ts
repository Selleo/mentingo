import { GROUPS_PAGE_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const selectGroupsFlow = async (page: Page, groupIds: string[]) => {
  for (const groupId of groupIds) {
    await page.getByTestId(GROUPS_PAGE_HANDLES.rowCheckbox(groupId)).click();
  }
};
