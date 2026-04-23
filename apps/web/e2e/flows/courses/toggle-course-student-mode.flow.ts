import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const toggleCourseStudentModeFlow = async (page: Page) => {
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.STUDENT_MODE_BUTTON).click();
};
