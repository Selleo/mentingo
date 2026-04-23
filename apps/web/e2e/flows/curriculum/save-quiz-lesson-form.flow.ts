import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const saveQuizLessonFormFlow = async (page: Page) => {
  await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.SAVE_BUTTON).click();
};
