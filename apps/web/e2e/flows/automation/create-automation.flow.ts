import { AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";

import type { Page } from "@playwright/test";

export const createAutomationFlow = async (page: Page) => {
  await page.getByTestId(AUTOMATION_PAGE_HANDLES.CREATE_BUTTON).click();
};
