import { COURSE_AUTHORING_HANDLES, CURRICULUM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const openCourseAuthoringFlow = async (page: Page) => {
  await page.getByTestId(CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON).click();
  await page.getByTestId(COURSE_AUTHORING_HANDLES.ROOT).waitFor();
};
