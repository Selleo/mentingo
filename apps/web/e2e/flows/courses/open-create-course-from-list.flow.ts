import { CREATE_COURSE_PAGE_HANDLES, COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openCreateCourseFromListFlow = async (page: Page) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.CREATE_BUTTON).click();
  await page.getByTestId(CREATE_COURSE_PAGE_HANDLES.PAGE).waitFor();
};
