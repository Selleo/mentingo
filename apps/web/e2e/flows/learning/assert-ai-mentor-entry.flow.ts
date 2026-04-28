import { expect, type Page } from "@playwright/test";

import { LEARNING_HANDLES } from "../../data/learning/handles";

export const assertAiMentorEntryFlow = async (page: Page) => {
  await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGES)).toBeVisible();
  await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_INPUT)).toBeVisible();
  await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_ACTION_BUTTON)).toBeVisible();
  await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON)).toBeVisible();
};
