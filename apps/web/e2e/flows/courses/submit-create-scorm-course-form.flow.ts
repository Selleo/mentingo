import { CREATE_SCORM_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const submitCreateScormCourseFormFlow = async (page: Page) => {
  await page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.SUBMIT_BUTTON).click();
};
