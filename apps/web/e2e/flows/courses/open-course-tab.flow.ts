import { EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import type { CourseTabValue } from "../../data/courses/handles";
import type { Page } from "@playwright/test";

export const openCourseTabFlow = async (page: Page, tab: CourseTabValue) => {
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.tab(tab)).click();
};
