import { USERS_PAGE_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

export const selectUsersFlow = async (page: Page, userIds: string[]) => {
  for (const userId of userIds) {
    await page.getByTestId(USERS_PAGE_HANDLES.rowCheckbox(userId)).click();
  }
};
