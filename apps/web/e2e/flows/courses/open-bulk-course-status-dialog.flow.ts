import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";
import type { CourseStatus } from "@repo/shared";

export const openBulkCourseStatusDialogFlow = async (page: Page, status: CourseStatus) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER).click();
  await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_STATUS_ACTION).click();
  await page.getByTestId(COURSES_PAGE_HANDLES.STATUS_DIALOG).waitFor();
  await page.getByTestId(COURSES_PAGE_HANDLES.statusOption(status)).click();
};
