import { CREATE_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const submitCreateCourseFormFlow = async (page: Page) => {
  await page.getByTestId(CREATE_COURSE_PAGE_HANDLES.SUBMIT_BUTTON).click();
};
