import { AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";

import type { Page } from "@playwright/test";

export const openAutomationPageFlow = async (page: Page) => {
  await page.goto("/admin/automation");
  await page.getByTestId(AUTOMATION_PAGE_HANDLES.PAGE).waitFor({ state: "visible" });
};
