import { QA_FORM_PAGE_HANDLES } from "../../data/qa/handles";
import { expect } from "../../fixtures/test.fixture";

import type { Page } from "@playwright/test";

export const submitQAFormFlow = async (page: Page) => {
  const saveButton = page.getByTestId(QA_FORM_PAGE_HANDLES.SAVE_BUTTON);

  await expect(saveButton).toBeEnabled();
  await saveButton.click();
};
