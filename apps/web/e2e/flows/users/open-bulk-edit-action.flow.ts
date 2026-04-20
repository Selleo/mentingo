import { expect } from "@playwright/test";

import { USER_BULK_EDIT_MODAL_HANDLES, USERS_PAGE_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

type BulkEditAction = "role" | "group" | "archive" | "delete";

const actionHandleMap: Record<BulkEditAction, string> = {
  role: USERS_PAGE_HANDLES.BULK_EDIT_ROLE_ACTION,
  group: USERS_PAGE_HANDLES.BULK_EDIT_GROUP_ACTION,
  archive: USERS_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION,
  delete: USERS_PAGE_HANDLES.BULK_EDIT_DELETE_ACTION,
};

export const openBulkEditActionFlow = async (page: Page, action: BulkEditAction) => {
  const trigger = page.getByTestId(USERS_PAGE_HANDLES.BULK_EDIT_TRIGGER);

  await expect(trigger).toBeEnabled();
  await trigger.click();
  await page.getByTestId(actionHandleMap[action]).click();
  await expect(page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.DIALOG)).toBeVisible();
};
