import { COURSE_STATUS_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";
import type { CourseStatus } from "@repo/shared";

export const selectCourseStatusFlow = async (page: Page, status: CourseStatus) => {
  await page.getByTestId(COURSE_STATUS_HANDLES.statusCard(status)).click();
};
