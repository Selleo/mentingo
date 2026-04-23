import { COURSE_STATUS_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const saveCourseStatusFlow = async (page: Page) => {
  await page.getByTestId(COURSE_STATUS_HANDLES.SAVE_BUTTON).click();
};
