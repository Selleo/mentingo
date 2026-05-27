import { LIVE_TRAINING_HANDLES } from "../../data/live-training/handles";
import { expect } from "../../fixtures/test.fixture";

import type { Page } from "@playwright/test";

export const openLiveTrainingFlow = async (page: Page, liveTrainingId: string) => {
  await page.goto(`/live-training/${liveTrainingId}`);
  await expect(page.getByTestId(LIVE_TRAINING_HANDLES.PAGE)).toBeVisible();
};
