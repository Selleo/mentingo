import { USER_BULK_EDIT_MODAL_HANDLES } from "../../data/users/handles";

import { closeMultiselectFlow } from "./close-multiselect.flow";

import type { Page } from "@playwright/test";

type FillBulkUserGroupsFlowInput = {
  groupIds: string[];
};

export const fillBulkUserGroupsFlow = async (
  page: Page,
  { groupIds }: FillBulkUserGroupsFlowInput,
) => {
  await page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.GROUPS_SELECT).click();

  for (const groupId of groupIds) {
    await page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.groupOption(groupId)).click();
  }

  await closeMultiselectFlow(page, {
    closeTarget: page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.DIALOG),
  });
};
