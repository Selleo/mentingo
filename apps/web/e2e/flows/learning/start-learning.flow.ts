import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

/** Clicks the learner's start/continue button on the course overview. */
export const startLearningFlow = async (page: Page) => {
  await page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON).click();
};
