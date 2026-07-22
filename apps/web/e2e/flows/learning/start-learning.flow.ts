import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const startLearningFlow = async (page: Page) => {
  const startLearningButton = page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON);

  if (await startLearningButton.isVisible({ timeout: 5_000 })) {
    await startLearningButton.click();
    return;
  }

  await page.locator('[data-section="toc"] button').first().click();
  await page.locator('a[href*="/lesson/"]').first().click();
};
