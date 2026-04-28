import { QA_LANGUAGE_SELECTOR_HANDLES } from "../../data/qa/handles";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

export const selectQALanguageFlow = async (page: Page, language: SupportedLanguages) => {
  await page.getByTestId(QA_LANGUAGE_SELECTOR_HANDLES.SELECT).click();
  await page.getByTestId(QA_LANGUAGE_SELECTOR_HANDLES.option(language)).click();
};
