import { expect, type Page } from "@playwright/test";

import { ENV_PAGE_HANDLES } from "../../data/environment/handles";

export const saveEnvironmentFormFlow = async (page: Page) => {
  const submitButton = page.getByTestId(ENV_PAGE_HANDLES.SUBMIT);

  await expect(submitButton).toBeVisible();
  await submitButton.click();
};
