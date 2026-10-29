import {
  LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES,
  LEARNING_PATH_CARD_HANDLES,
  LEARNING_PATH_TRAIL_HANDLES,
} from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const addCoursesToLearningPathFlow = async (
  page: Page,
  learningPathId: string,
  courseIds: string[],
) => {
  await page
    .getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId))
    .getByTestId(LEARNING_PATH_TRAIL_HANDLES.ADD_COURSE_BUTTON)
    .click();

  const dialog = page.getByTestId(LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES.DIALOG);
  await dialog.waitFor();

  for (const courseId of courseIds) {
    await dialog.getByTestId(LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES.option(courseId)).click();
  }

  await dialog.getByTestId(LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES.SUBMIT_BUTTON).click();
  await dialog.waitFor({ state: "hidden" });
};
