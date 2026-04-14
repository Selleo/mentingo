import { GROUPS_PAGE_HANDLES } from "../../data/groups/handles";

import type { Page } from "@playwright/test";

export const cancelDeleteGroupsDialogFlow = async (page: Page) => {
  await page.getByTestId(GROUPS_PAGE_HANDLES.DELETE_DIALOG_CANCEL_BUTTON).click();
  await page.getByTestId(GROUPS_PAGE_HANDLES.DELETE_DIALOG).waitFor({ state: "hidden" });
};
