import { EMBED_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const saveEmbedLessonFormFlow = async (page: Page) => {
  await page.getByTestId(EMBED_LESSON_FORM_HANDLES.SAVE_BUTTON).click();
};
