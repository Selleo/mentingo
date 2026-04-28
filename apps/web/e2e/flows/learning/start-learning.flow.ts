import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const startLearningFlow = async (page: Page) => {
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON).click();
};
