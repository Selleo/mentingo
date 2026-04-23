import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const fillQuizLessonTitleFlow = async (page: Page, title: string) => {
  await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.TITLE_INPUT).fill(title);
};
