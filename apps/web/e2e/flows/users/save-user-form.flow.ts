import { USER_PAGE_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

export const saveUserFormFlow = async (page: Page) => {
  await page.getByTestId(USER_PAGE_HANDLES.SAVE_BUTTON).click();
};
