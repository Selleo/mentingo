import { USERS_IMPORT_MODAL_HANDLES } from "../../data/users/handles";

import type { Page } from "@playwright/test";

export const submitImportUsersFlow = async (page: Page) => {
  await page.getByTestId(USERS_IMPORT_MODAL_HANDLES.SUBMIT).click();
};
