import { CONTENT_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const saveContentLessonFormFlow = async (page: Page) => {
  await page.getByTestId(CONTENT_LESSON_FORM_HANDLES.SAVE_BUTTON).click();
  await page.getByTestId(CONTENT_LESSON_FORM_HANDLES.ROOT).waitFor({ state: "hidden" });
};
