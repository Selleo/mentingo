import {
  LEARNING_PATH_CARD_HANDLES,
  LEARNING_PATH_SETTINGS_DRAWER_HANDLES,
} from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const openLearningPathSettingsDrawerFlow = async (page: Page, learningPathId: string) => {
  await page
    .getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId))
    .getByTestId(LEARNING_PATH_CARD_HANDLES.SETTINGS_TRIGGER)
    .click();
  await page.getByTestId(LEARNING_PATH_SETTINGS_DRAWER_HANDLES.DRAWER).waitFor();
};

export const publishLearningPathFlow = async (page: Page, learningPathId: string) => {
  await openLearningPathSettingsDrawerFlow(page, learningPathId);
  await page.getByTestId(LEARNING_PATH_SETTINGS_DRAWER_HANDLES.STATUS_SELECT).click();
  await page.getByTestId(LEARNING_PATH_SETTINGS_DRAWER_HANDLES.statusOption("published")).click();
  await page.getByTestId(LEARNING_PATH_SETTINGS_DRAWER_HANDLES.CLOSE_BUTTON).click();
};
