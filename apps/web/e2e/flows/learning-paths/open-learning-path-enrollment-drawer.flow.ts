import {
  LEARNING_PATH_CARD_HANDLES,
  LEARNING_PATH_ENROLLED_HANDLES,
} from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const openLearningPathEnrollmentDrawerFlow = async (page: Page, learningPathId: string) => {
  await page
    .getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId))
    .getByTestId(LEARNING_PATH_CARD_HANDLES.ENROLLMENT_TRIGGER)
    .click();
  await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.DRAWER).waitFor();
};
