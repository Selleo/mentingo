import { SCORM_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const saveScormLessonFormFlow = async (page: Page) => {
  await page.getByTestId(SCORM_LESSON_FORM_HANDLES.SAVE_BUTTON).click();
};
