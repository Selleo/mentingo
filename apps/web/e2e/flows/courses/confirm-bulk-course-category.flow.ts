import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const confirmBulkCourseCategoryFlow = async (page: Page) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.CATEGORY_DIALOG_CONFIRM_BUTTON).click();
};
