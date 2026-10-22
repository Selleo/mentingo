import { LEARNING_PATH_CARD_HANDLES } from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const editLearningPathDescriptionFlow = async (
  page: Page,
  learningPathId: string,
  description: string,
) => {
  const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId));

  await card.getByTestId(LEARNING_PATH_CARD_HANDLES.DESCRIPTION).click();

  const descriptionInput = card.getByTestId(LEARNING_PATH_CARD_HANDLES.DESCRIPTION_INPUT);
  await descriptionInput.fill(description);
  await descriptionInput.press("Enter");
  await descriptionInput.waitFor({ state: "hidden" });
};
