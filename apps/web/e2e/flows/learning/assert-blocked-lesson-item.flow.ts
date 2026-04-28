import { expect, type Page } from "@playwright/test";

import { LEARNING_HANDLES } from "../../data/learning/handles";

export const assertBlockedLessonItemFlow = async (page: Page, lessonId: string) => {
  await expect(page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(lessonId))).toBeVisible();
  await expect(
    page.getByTestId(LEARNING_HANDLES.lessonSidebarBlockedIndicator(lessonId)),
  ).toBeVisible();
};
