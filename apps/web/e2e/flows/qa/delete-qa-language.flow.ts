import { QA_LANGUAGE_SELECTOR_HANDLES } from "../../data/qa/handles";

import type { Page } from "@playwright/test";

export const deleteQALanguageFlow = async (page: Page) => {
  await page.getByTestId(QA_LANGUAGE_SELECTOR_HANDLES.DELETE_BUTTON).click();
  await page.getByTestId(QA_LANGUAGE_SELECTOR_HANDLES.DELETE_DIALOG).waitFor();
  await page.getByTestId(QA_LANGUAGE_SELECTOR_HANDLES.DELETE_CONFIRM_BUTTON).click();
};
