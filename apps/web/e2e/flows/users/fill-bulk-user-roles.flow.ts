import { USER_BULK_EDIT_MODAL_HANDLES } from "../../data/users/handles";

import { closeMultiselectFlow } from "./close-multiselect.flow";

import type { Page } from "@playwright/test";

type FillBulkUserRolesFlowInput = {
  roleSlugs: string[];
};

export const fillBulkUserRolesFlow = async (
  page: Page,
  { roleSlugs }: FillBulkUserRolesFlowInput,
) => {
  await page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.ROLE_SELECT).click();

  for (const roleSlug of roleSlugs) {
    await page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.roleOption(roleSlug)).click();
  }

  await closeMultiselectFlow(page, {
    closeTarget: page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.DIALOG),
  });
};
