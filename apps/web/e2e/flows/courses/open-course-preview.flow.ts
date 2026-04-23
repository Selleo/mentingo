import { EDIT_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openCoursePreviewFlow = async (page: Page) => {
  await page.getByTestId(EDIT_COURSE_PAGE_HANDLES.PREVIEW_BUTTON).click();
};
