import { CREATE_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openCreateCoursePageFlow = async (page: Page) => {
  await page.goto("/admin/beta-courses/new");
  await page.getByTestId(CREATE_COURSE_PAGE_HANDLES.PAGE).waitFor();
};
