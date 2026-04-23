import { COURSE_GENERATION_HANDLES, CURRICULUM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const openCourseGenerationFlow = async (page: Page) => {
  await page.getByTestId(CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON).click();
  await page.getByTestId(COURSE_GENERATION_HANDLES.DRAWER).waitFor();
};
