import { USERS_IMPORT_MODAL_HANDLES, USERS_PAGE_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

export const openImportUsersModalFlow = async (page: Page) => {
  await page.getByTestId(USERS_PAGE_HANDLES.IMPORT_BUTTON).click();
  await page.getByTestId(USERS_IMPORT_MODAL_HANDLES.ROOT).waitFor({ state: "visible" });
};
