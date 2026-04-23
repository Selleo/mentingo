import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openDeleteCoursesDialogFlow = async (page: Page) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.DELETE_SELECTED_BUTTON).click();
  await page.getByTestId(COURSES_PAGE_HANDLES.DELETE_DIALOG).waitFor();
};
