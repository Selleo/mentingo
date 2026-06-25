import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const confirmBulkCourseStatusFlow = async (page: Page) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.STATUS_DIALOG_CONFIRM_BUTTON).click();
};
