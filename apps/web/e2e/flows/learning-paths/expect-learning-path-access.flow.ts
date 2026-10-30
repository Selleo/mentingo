import { expect, type Page } from "@playwright/test";

import { LEARNING_PATH_CARD_HANDLES } from "../../data/learning-paths/handles";

/** Enrollment grants access regardless of whether seeded courses already have progress. */
export const expectLearningPathAccessFlow = async (page: Page, learningPathId: string) => {
  const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId));
  const courseLink = card.getByTestId(LEARNING_PATH_CARD_HANDLES.CONTINUE_BUTTON);

  await expect(card).toBeVisible();
  await expect(courseLink).toBeVisible();
  await expect(courseLink).toBeEnabled();
  await expect(courseLink).toHaveAttribute("href", /^\/course\/[^/?#]+$/);

  return courseLink;
};
