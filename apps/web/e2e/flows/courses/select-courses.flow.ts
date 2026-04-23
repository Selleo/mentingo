import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const selectCoursesFlow = async (page: Page, courseIds: string[]) => {
  for (const courseId of courseIds) {
    await page.getByTestId(COURSES_PAGE_HANDLES.rowCheckbox(courseId)).click();
  }
};
