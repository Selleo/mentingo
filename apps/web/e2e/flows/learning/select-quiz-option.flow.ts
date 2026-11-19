import { LEARNING_HANDLES } from "../../data/learning/handles";

import type { Page } from "@playwright/test";

export const selectQuizOptionFlow = async (page: Page, optionId: string) => {
  await page.getByTestId(LEARNING_HANDLES.quizOption(optionId)).click();
};
