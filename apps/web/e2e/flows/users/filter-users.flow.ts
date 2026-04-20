import { USERS_PAGE_HANDLES } from "../../data/users/handles";

import { closeMultiselectFlow } from "./close-multiselect.flow";

import type { Page } from "@playwright/test";

type FilterUsersFlowInput = {
  keyword?: string;
  roleSlug?: string;
  archivedStatus?: "all" | "active" | "archived";
  groupIds?: string[];
  clearAll?: boolean;
};

export const filterUsersFlow = async (
  page: Page,
  { keyword, roleSlug, archivedStatus, groupIds, clearAll }: FilterUsersFlowInput,
) => {
  if (clearAll) {
    await page.getByTestId(USERS_PAGE_HANDLES.CLEAR_FILTERS_BUTTON).click();
  }

  if (keyword !== undefined) {
    await page.getByTestId(USERS_PAGE_HANDLES.SEARCH_INPUT).fill(keyword);
  }

  if (roleSlug) {
    await page.getByTestId(USERS_PAGE_HANDLES.ROLE_FILTER).click();
    await page.getByTestId(USERS_PAGE_HANDLES.roleFilterOption(roleSlug)).click();
  }

  if (archivedStatus) {
    await page.getByTestId(USERS_PAGE_HANDLES.STATUS_FILTER).click();
    await page.getByTestId(USERS_PAGE_HANDLES.statusFilterOption(archivedStatus)).click();
  }

  if (groupIds?.length) {
    await page.getByTestId(USERS_PAGE_HANDLES.GROUPS_FILTER).click();

    for (const groupId of groupIds) {
      await page.getByTestId(USERS_PAGE_HANDLES.groupFilterOption(groupId)).click();
    }

    await closeMultiselectFlow(page, {
      closeTarget: page.getByTestId(USERS_PAGE_HANDLES.SEARCH_INPUT),
    });
  }
};
