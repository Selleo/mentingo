import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openCoursesPageFlow = async (page: Page) => {
  await page.goto("/admin/courses");
  await page.getByTestId(COURSES_PAGE_HANDLES.PAGE).waitFor();
};
