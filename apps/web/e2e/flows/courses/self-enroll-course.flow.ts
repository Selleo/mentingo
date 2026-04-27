import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const selfEnrollCourseFlow = async (page: Page, courseIdOrSlug: string) => {
  await page.goto(`/course/${courseIdOrSlug}`);
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.ENROLL_BUTTON).click();
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON).waitFor();
};
