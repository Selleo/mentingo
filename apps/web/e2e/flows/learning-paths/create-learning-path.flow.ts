import {
  LEARNING_PATH_CREATE_DIALOG_HANDLES,
  LEARNING_PATHS_PAGE_HANDLES,
} from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

type CreateLearningPathFlowInput = {
  title: string;
  description: string;
};

export const createLearningPathFlow = async (
  page: Page,
  { title, description }: CreateLearningPathFlowInput,
) => {
  await page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.CREATE_BUTTON).click();

  const dialog = page.getByTestId(LEARNING_PATH_CREATE_DIALOG_HANDLES.DIALOG);
  await dialog.waitFor();

  await dialog.getByTestId(LEARNING_PATH_CREATE_DIALOG_HANDLES.TITLE_INPUT).fill(title);
  await dialog.getByTestId(LEARNING_PATH_CREATE_DIALOG_HANDLES.DESCRIPTION_INPUT).fill(description);
  await dialog.getByTestId(LEARNING_PATH_CREATE_DIALOG_HANDLES.SUBMIT_BUTTON).click();

  await dialog.waitFor({ state: "hidden" });
};
