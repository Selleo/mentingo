import { QA_FORM_PAGE_HANDLES, QA_LANGUAGE_SELECTOR_HANDLES } from "../../data/qa/handles";
import { expect } from "../../fixtures/test.fixture";

import { selectQALanguageFlow } from "./select-qa-language.flow";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

export const createQALanguageFlow = async (page: Page, language: SupportedLanguages) => {
  await selectQALanguageFlow(page, language);
  await page.getByTestId(QA_LANGUAGE_SELECTOR_HANDLES.CREATE_DIALOG).waitFor();
  await page.getByTestId(QA_LANGUAGE_SELECTOR_HANDLES.CREATE_CONFIRM_BUTTON).click();
  await expect(page.getByTestId(QA_LANGUAGE_SELECTOR_HANDLES.CREATE_DIALOG)).toHaveCount(0);
  await expect(page.getByTestId(QA_FORM_PAGE_HANDLES.TITLE_INPUT)).toHaveValue("");
  await expect(page.getByTestId(QA_FORM_PAGE_HANDLES.DESCRIPTION_INPUT)).toHaveValue("");
};
