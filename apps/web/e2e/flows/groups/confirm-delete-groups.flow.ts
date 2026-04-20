import { GROUPS_PAGE_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const confirmDeleteGroupsFlow = async (page: Page) => {
  await page.getByTestId(GROUPS_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON).click();
};
