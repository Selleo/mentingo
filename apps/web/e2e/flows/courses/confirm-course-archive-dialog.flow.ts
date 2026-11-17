import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const confirmCourseArchiveDialogFlow = async (page: Page) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CONFIRM_BUTTON).click();
};

export const cancelCourseArchiveDialogFlow = async (page: Page) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CANCEL_BUTTON).click();
};
