import { LEARNING_PATH_CARD_HANDLES } from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const addCourseToLearningPathFlow = async (
  page: Page,
  learningPathId: string,
  courseId: string,
) => {
  const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId));

  await card.getByTestId(LEARNING_PATH_CARD_HANDLES.ADD_COURSES_TRIGGER).click();
  await card.getByTestId(LEARNING_PATH_CARD_HANDLES.ADD_COURSES_SELECT).click();
  await card.getByTestId(LEARNING_PATH_CARD_HANDLES.addCoursesOption(courseId)).click();
  await card.getByTestId(LEARNING_PATH_CARD_HANDLES.ADD_COURSES_CONFIRM_BUTTON).click();
};
