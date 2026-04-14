import { USERS_PAGE_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

export const openUserDetailsFromListFlow = async (page: Page, userId: string) => {
  await page.getByTestId(USERS_PAGE_HANDLES.row(userId)).click();
};
