import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const saveAiMentorLessonFormFlow = async (page: Page) => {
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.SAVE_BUTTON).click();
  await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.ROOT).waitFor({ state: "hidden" });
};
