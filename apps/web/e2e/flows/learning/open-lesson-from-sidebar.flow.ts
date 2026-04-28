import { LEARNING_HANDLES } from "../../data/learning/handles";

import type { Page } from "@playwright/test";

export const openLessonFromSidebarFlow = async (page: Page, lessonId: string) => {
  await page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(lessonId)).click();
};
