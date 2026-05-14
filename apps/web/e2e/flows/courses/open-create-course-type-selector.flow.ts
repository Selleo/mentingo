import { COURSE_TYPE_SELECTOR_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openCreateCourseTypeSelectorFlow = async (page: Page) => {
  await page.goto("/admin/beta-courses/new");
  await page.getByTestId(COURSE_TYPE_SELECTOR_HANDLES.PAGE).waitFor();
};
