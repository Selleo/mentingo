import type { Page } from "@playwright/test";

export const selectFirstSingleChoiceAnswerFlow = async (page: Page) => {
  await page.locator('input[name^="singleAnswerQuestions."]').first().click();
};
