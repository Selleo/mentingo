import { USERS_IMPORT_MODAL_HANDLES } from "../../data/users/handles";
import { expect } from "../../fixtures/test.fixture";

import type { Page } from "@playwright/test";

export const uploadUsersImportFileFlow = async (page: Page, filePath: string) => {
  await page.getByTestId(USERS_IMPORT_MODAL_HANDLES.FILE_INPUT).setInputFiles(filePath);
  await expect(page.getByTestId(USERS_IMPORT_MODAL_HANDLES.SUBMIT)).toBeEnabled();
};
