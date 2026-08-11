import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";
import { expect } from "../../fixtures/test.fixture";

import type { Page } from "@playwright/test";

export const openCourseDetailsFromListFlow = async (page: Page, courseId: string) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.row(courseId)).click();
  await expect(page).toHaveURL(new RegExp(`/course/${courseId}$`));
};
