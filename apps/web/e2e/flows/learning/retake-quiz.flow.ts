import { LEARNING_HANDLES } from "../../data/learning/handles";

import type { Page } from "@playwright/test";

export const retakeQuizFlow = async (page: Page) => {
  await page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON).click();
};
