import { ADMIN_LEARNING_PATHS_HANDLES } from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const createLearningPathFlow = async (
  page: Page,
  input: { title: string; description: string },
) => {
  await page.getByTestId(ADMIN_LEARNING_PATHS_HANDLES.CREATE_BUTTON).click();
  await page.getByTestId(ADMIN_LEARNING_PATHS_HANDLES.CREATE_TITLE_INPUT).fill(input.title);
  await page
    .getByTestId(ADMIN_LEARNING_PATHS_HANDLES.CREATE_DESCRIPTION_INPUT)
    .fill(input.description);
  await page.getByTestId(ADMIN_LEARNING_PATHS_HANDLES.CREATE_SUBMIT_BUTTON).click();
};
