import { COURSES_PAGE_HANDLES, EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openCourseDetailsFromListFlow = async (page: Page, courseId: string) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.row(courseId)).click();
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.PAGE).waitFor();
};
