import {
  LEARNING_PATH_CARD_HANDLES,
  LEARNING_PATH_SETTINGS_HANDLES,
} from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const openLearningPathSettingsFlow = async (page: Page, learningPathId: string) => {
  await page
    .getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId))
    .getByTestId(LEARNING_PATH_CARD_HANDLES.SETTINGS_BUTTON)
    .click();
  await page.getByTestId(LEARNING_PATH_SETTINGS_HANDLES.DRAWER).waitFor();
};

export const openLearningPathSettingsTabFlow = async (
  page: Page,
  learningPathId: string,
  tab: string,
) => {
  await openLearningPathSettingsFlow(page, learningPathId);
  await page.getByTestId(LEARNING_PATH_SETTINGS_HANDLES.tab(tab)).click();
};
