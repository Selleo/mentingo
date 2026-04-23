import { EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import type { CourseTabValue } from "../../data/courses/handles";
import type { Page } from "@playwright/test";

export const openEditCoursePageFlow = async (
  page: Page,
  courseId: string,
  tab?: CourseTabValue,
) => {
  const params = tab ? `?tab=${encodeURIComponent(tab)}` : "";

  await page.goto(`/admin/beta-courses/${courseId}${params}`);
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.PAGE).waitFor();
};
