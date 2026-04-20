import { USER_PAGE_HANDLES } from "../../data/users/handles";

import { closeMultiselectFlow } from "./close-multiselect.flow";

import type { Page } from "@playwright/test";

type FillUserFormFlowInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  roleSlugs?: string[];
  groupIds?: string[];
  archived?: boolean;
};

export const fillUserFormFlow = async (
  page: Page,
  { firstName, lastName, email, roleSlugs, groupIds, archived }: FillUserFormFlowInput,
) => {
  if (firstName !== undefined) {
    await page.getByTestId(USER_PAGE_HANDLES.FIRST_NAME_INPUT).fill(firstName);
  }

  if (lastName !== undefined) {
    await page.getByTestId(USER_PAGE_HANDLES.LAST_NAME_INPUT).fill(lastName);
  }

  if (email !== undefined) {
    await page.getByTestId(USER_PAGE_HANDLES.EMAIL_INPUT).fill(email);
  }

  if (roleSlugs?.length) {
    await page.getByTestId(USER_PAGE_HANDLES.ROLE_SELECT).click();

    for (const roleSlug of roleSlugs) {
      await page.getByTestId(USER_PAGE_HANDLES.roleOption(roleSlug)).click();
    }

    await closeMultiselectFlow(page, {
      closeTarget: page.getByTestId(USER_PAGE_HANDLES.EMAIL_INPUT),
    });
  }

  if (groupIds?.length) {
    await page.getByTestId(USER_PAGE_HANDLES.GROUPS_SELECT).click();

    for (const groupId of groupIds) {
      await page.getByTestId(USER_PAGE_HANDLES.groupOption(groupId)).click();
    }

    await closeMultiselectFlow(page, {
      closeTarget: page.getByTestId(USER_PAGE_HANDLES.EMAIL_INPUT),
    });
  }

  if (archived !== undefined) {
    const archivedCheckbox = page.getByTestId(USER_PAGE_HANDLES.ARCHIVED_CHECKBOX);

    if ((await archivedCheckbox.isChecked()) !== archived) {
      await archivedCheckbox.click();
    }
  }
};
