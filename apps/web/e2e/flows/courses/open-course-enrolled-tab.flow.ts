import { COURSE_ENROLLED_HANDLES, COURSE_TAB_VALUES } from "../../data/courses/handles";

import { openEditCoursePageFlow } from "./open-edit-course-page.flow";

import type { Page } from "@playwright/test";

export const openCourseEnrolledTabFlow = async (page: Page, courseId: string) => {
  await openEditCoursePageFlow(page, courseId, COURSE_TAB_VALUES.ENROLLED);
  await page.getByTestId(COURSE_ENROLLED_HANDLES.ROOT).waitFor();
};
