import { AUTOMATION_DRAWER_HANDLES, AUTOMATION_PAGE_HANDLES } from "../../data/automation/handles";

import type { Page } from "@playwright/test";

/**
 * Triggers deletion from the drawer and confirms the delete dialog.
 * Assumes the drawer is already open for the target automation.
 */
export const deleteAutomationFromDrawerFlow = async (page: Page) => {
  await page.getByTestId(AUTOMATION_DRAWER_HANDLES.DELETE_BUTTON).click();
  await page.getByTestId(AUTOMATION_PAGE_HANDLES.DELETE_DIALOG_CONFIRM).click();
};
