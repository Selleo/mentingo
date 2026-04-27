import { QA_FORM_PAGE_HANDLES } from "../../data/qa/handles";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

type FillQAFormFlowInput = {
  language?: SupportedLanguages;
  title?: string;
  description?: string;
};

export const fillQAFormFlow = async (
  page: Page,
  { language, title, description }: FillQAFormFlowInput,
) => {
  if (language !== undefined) {
    await page.getByTestId(QA_FORM_PAGE_HANDLES.LANGUAGE_SELECT).click();
    await page.getByTestId(QA_FORM_PAGE_HANDLES.languageOption(language)).click();
  }

  if (title !== undefined) {
    await page.getByTestId(QA_FORM_PAGE_HANDLES.TITLE_INPUT).fill(title);
  }

  if (description !== undefined) {
    await page.getByTestId(QA_FORM_PAGE_HANDLES.DESCRIPTION_INPUT).fill(description);
  }
};
