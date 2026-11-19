import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";

import type { Page } from "@playwright/test";

export const uploadLoginPageDocumentFlow = async (page: Page, displayName: string) => {
  await page
    .getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILES_INPUT)
    .setInputFiles(CURRICULUM_TEST_DATA.files.documentPreview);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_NAME_INPUT).fill(displayName);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.LOGIN_PAGE_FILE_SAVE).click();
};
