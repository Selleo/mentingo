import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const confirmDeleteCoursesFlow = async (page: Page) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON).click();
};
