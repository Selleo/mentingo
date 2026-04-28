import { LEARNING_HANDLES } from "../../data/learning/handles";

import type { Page } from "@playwright/test";

export const goToNextLessonFlow = async (page: Page) => {
  await page.getByTestId(LEARNING_HANDLES.NEXT_LESSON_BUTTON).click();
};
