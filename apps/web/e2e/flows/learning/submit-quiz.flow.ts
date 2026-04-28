import { LEARNING_HANDLES } from "../../data/learning/handles";

import type { Page } from "@playwright/test";

export const submitQuizFlow = async (page: Page) => {
  await page.getByTestId(LEARNING_HANDLES.QUIZ_SUBMIT_BUTTON).click();
};
